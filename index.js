import { tokenList, chainInfo } from "./info.js";

let selectSide,
  lastFetchSide = "from",
  chain = "",
  currentChainId,
  chainList = {};
const chainIds = [1, 5, 10, 137, 42161];
let currentTrade = { from: "", to: "" };
let swapJSON = {
  price: {},
  quote: {},
};
let tAmount = { from: 0, to: 0 },
  pretAmount = { from: 0, to: 0 };
let ftNode = document.getElementById("from_token_select"),
  ttNode = document.getElementById("to_token_select"),
  faNode = document.getElementById("from_amount"),
  taNode = document.getElementById("to_amount"),
  exchangeB = document.getElementById("b1"),
  myInput = document.getElementById("myInput"),
  login_button = document.getElementById("login_button"),
  swap_button = document.getElementById("swap_button"),
  chain_button = document.getElementById("chain_button"),
  loadStr = document.getElementById("loadStr"),
  modalBody = document.getElementById("m-body"),
  chainContent = document.getElementById("cm_content"),
  chainImg = chain_button.getElementsByTagName("img")[0],
  chainSpan = chain_button.getElementsByTagName("span")[0];
const emptyNode = document.createElement("div");
modalBody.appendChild(emptyNode);
let currentChain = emptyNode;

async function connect() {
  if (login_button.innerHTML === "Connected") return;
  if (typeof window.ethereum !== "undefined") {
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      login_button.innerHTML = "Connected";
      login_button.style.backgroundColor = "#62ad47";
      swap_button.disabled = false;
    } catch (error) {
      console.log(error);
    }
  } else {
    login_button.innerHTML = "Please install MetaMask";
  }
}

function searchToken() {
  let input, filter, div, a, i, txtValue;
  input = document.getElementById("myInput");
  filter = input.value.toUpperCase();
  div = currentChain.getElementsByTagName("div");
  for (i = 0; i < div.length; i++) {
    a = div[i].getElementsByTagName("span")[0];
    txtValue = a.textContent;
    if (txtValue.startsWith(filter)) {
      div[i].style.display = "";
    } else {
      div[i].style.display = "none";
    }
  }
}

function selectToken(token) {
  $("#token_modal").modal("hide");
  currentTrade[selectSide] = token;
  document.getElementById(`${selectSide}_token_img`).src =
    currentTrade[selectSide].logoURI;
  document.getElementById(`${selectSide}_token_text`).textContent =
    currentTrade[selectSide].symbol;
}

function exchangePos() {
  function showAni() {
    exchangeB.classList.remove("ani");
    void exchangeB.offsetWidth;
    exchangeB.classList.add("ani");
  }
  showAni();
  [
    ftNode.getElementsByTagName("img")[0].src,
    ttNode.getElementsByTagName("img")[0].src,
    ftNode.getElementsByTagName("span")[0].textContent,
    ttNode.getElementsByTagName("span")[0].textContent,
    faNode.value,
    taNode.value,
    pretAmount.from,
    pretAmount.to,
    currentTrade.from,
    currentTrade.to,
  ] = [
    ttNode.getElementsByTagName("img")[0].src,
    ftNode.getElementsByTagName("img")[0].src,
    ttNode.getElementsByTagName("span")[0].textContent,
    ftNode.getElementsByTagName("span")[0].textContent,
    taNode.value,
    faNode.value,
    pretAmount.to,
    pretAmount.from,
    currentTrade.to,
    currentTrade.from,
  ];
}

function openModal(side) {
  selectSide = side;
  modalBody.style.display = "block";
}

async function getData(endpoint, side) {
  if (chain === "-" || !currentTrade.from || !currentTrade.to) return;
  let _tAmount = (tAmount[side] = document.getElementById(
    `${side}_amount`
  ).value);
  if (parseFloat(_tAmount)) {
    if (endpoint === "price" && pretAmount[side] === _tAmount) return;
    pretAmount[side] = _tAmount;
    try {
      await fetchData(endpoint, side);
      lastFetchSide = side;
    } catch (e) {}
    loadStr.innerHTML = "";
  }
}

async function fetchData(endpoint, side) {
  loadStr.innerHTML = `fetching ${endpoint}...`;
  let sideStr, contraSide, contraStr, numOf0;
  if (side === "from") {
    sideStr = "sellAmount";
    contraSide = "to";
    contraStr = "buyAmount";
  } else {
    sideStr = "buyAmount";
    contraSide = "from";
    contraStr = "sellAmount";
  }

  let _amountStr = tAmount[side];
  let amountArray = _amountStr.split(".");
  if (amountArray.length > 1) {
    numOf0 = currentTrade[side].decimals - amountArray[1].length;
  } else {
    numOf0 = currentTrade[side].decimals;
  }
  _amountStr = amountArray.join("").replace(/0*/, "");
  let amountStr = _amountStr + "0".repeat(numOf0);
  let params = `sellToken=${currentTrade.from.address}&buyToken=${currentTrade.to.address}&${sideStr}=${amountStr}`;
  const response = await fetch(
    `https://${chain}api.0x.org/swap/v1/${endpoint}?${params}`
  );
  let swapJson = (swapJSON[endpoint] = await response.json());
  if (response.status !== 200) {
    alert(swapJson.reason);
    return;
  }
  let contraAmount = (
    swapJson[contraStr] /
    10 ** currentTrade[contraSide].decimals
  ).toString();
  pretAmount[contraSide] = contraAmount;
  document.getElementById(`${contraSide}_amount`).value = contraAmount;
  getSources(endpoint);
  await calGasFee(endpoint);
}

async function calGasFee(endpoint) {
  function cutDemcimal(number) {
    let nStr = number.toString();
    const indexE = nStr.indexOf("e");
    if (indexE !== -1) {
      const _numOf0 = -1 * parseInt(nStr.slice(indexE + 1));
      const fill0Str = "0".repeat(_numOf0 - 1);
      const _nStr = `0.${fill0Str}${nStr[0]}${nStr[2]}`;
      return _nStr;
    }
    const indexDot = nStr.indexOf(".");
    if (indexDot !== -1) {
      for (let i = indexDot + 1; i < nStr.length - 2; i++) {
        if (nStr.charAt(i) !== "0") return nStr.slice(0, i + 2);
      }
    }
  }

  let swapJson = swapJSON[endpoint];
  let estimatedGas = swapJson.estimatedGas;
  let symbol = chain === "polygon." ? "MATIC" : "ETH";
  const bUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`;
  let response = await fetch(bUrl).then((data) => data.json());
  let ethPrice = response.price;
  const gasPrice = swapJson.gasPrice;
  const gas = (estimatedGas * gasPrice) / 10 ** 18;
  const gasFee = gas * ethPrice;

  console.log(gas, gasFee);
  const gasStr = cutDemcimal(gas);
  const gasFeeStr = cutDemcimal(gasFee);
  console.log(gasStr, gasFeeStr);
  const _gas = `${gasStr}${symbol} ($${gasFeeStr})`;
  document.getElementById("gas_estimate").innerHTML = _gas;
}

function getSources(endpoint) {
  function bubbleSort(arr) {
    let len = arr.length;
    for (let i = 0; i < len - 1; i++) {
      for (let j = 0; j < len - 1 - i; j++) {
        if (arr[j].proportion < arr[j + 1].proportion) {
          let temp = arr[j + 1];
          arr[j + 1] = arr[j];
          arr[j] = temp;
        }
      }
    }
    return arr;
  }
  let _validSources = [];
  let sources = swapJSON[endpoint].sources;
  sources.forEach((source) => {
    if (source.proportion !== "0") {
      source.proportion = parseFloat(source.proportion);
      _validSources.push(source);
    }
  });
  let validSources = bubbleSort(_validSources);
  let vStr = "";
  validSources.forEach((vSource) => {
    vSource.proportion = Math.round(vSource.proportion * 10 ** 4) / 100;
    vStr += `(${vSource.name}: ${vSource.proportion}%) `;
  });
  document.getElementById("sources").innerHTML = vStr;
}

function chainIdToChain(_chainId) {
  const chainId = parseInt(_chainId);
  let _chainInfo = chainInfo[chainId];
  if (_chainInfo !== undefined) {
    chain = _chainInfo.prefix;
    chainSpan.innerText = _chainInfo.name;
    chainImg.src = _chainInfo.src;
    chain_button.style.background =
      "linear-gradient(62deg, #71b6fa 0%, #d6a8fd 100%)";
    const newChain = chainList[chainId];
    modalBody.replaceChild(newChain, currentChain);
    currentChain = newChain;
  } else {
    chain = "-";
    chainSpan.innerText = "Unsupported Chain";
    chainImg.src = "./src/alchemyLogo.png";
    chain_button.style.backgroundColor = "#878787";
    modalBody.replaceChild(emptyNode, currentChain);
    currentChain = emptyNode;
  }
  currentChainId = chainId;

  ftNode.getElementsByTagName("img")[0].src = "./src/alchemyLogo.png";
  ttNode.getElementsByTagName("img")[0].src = "./src/alchemyLogo.png";
  ftNode.getElementsByTagName("span")[0].textContent = "Select Token";
  ttNode.getElementsByTagName("span")[0].textContent = "Select Token";
  faNode.value = "";
  taNode.value = "";
  pretAmount.from = "";
  pretAmount.to = "";
  currentTrade.from = "";
  currentTrade.to = "";
  document.getElementById("gas_estimate").innerHTML = "";
  document.getElementById("sources").innerHTML = "";
}

function callMetamask(to, sendData, foo) {
  ethereum
    .request({
      method: "eth_sendTransaction",
      params: [
        {
          from: ethereum.selectedAddress,
          to: to,
          data: sendData,
        },
      ],
    })
    .then((txHash) => {
      console.log(txHash);
      loadStr.innerHTML = `waiting confirmed...`;
      setTimeout(waitMined(txHash, foo), 15000);
    })
    .catch((e) => alert(e.message));
}

function waitMined(txHash, foo) {
  let num = 1;
  let i1;
  i1 = setInterval(() => {
    ethereum
      .request({
        method: "eth_getTransactionByHash",
        params: [txHash],
      })
      .then((data) => {
        if (data) {
          if (data.blockNumber) {
            foo();
          } else return;
        } else alert("transaction error");
        loadStr.innerHTML = "";
        clearInterval(i1);
      })
      .catch((error) => alert(error));
    console.log(num);
    num++;
    if (num > 8) {
      alert("time out");
      loadStr.innerHTML = "";
      clearInterval(i1);
    }
  }, 15000);
}

async function trySwap() {
  try {
    await getData("quote", lastFetchSide);
    const quoteJSON = swapJSON.quote;
    const targetAddr = quoteJSON.allowanceTarget.slice(2);
    const addrData = "0".repeat(64 - targetAddr.length) + targetAddr;
    const sellAmount = quoteJSON.sellAmount.toString(16);
    const sAmountData = "0".repeat(64 - sellAmount.length) + sellAmount;

    const apKec = "095ea7b3";
    const sendData = `0x${apKec}${addrData}${sAmountData}`;
    const foo1 = () => callMetamask(quoteJSON.to, quoteJSON.data, () => {});
    callMetamask(currentTrade.from.address, sendData, foo1);
  } catch (e) {
    alert(e.message);
  }
}

function switchChain(_chainId) {
  if (_chainId === currentChainId) return;
  let chainId = _chainId.toString(16);
  ethereum
    .request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${chainId}` }],
    })
    .catch((e) => {
      if (e.code === 4902) addChain(_chainId);
    });
}

function addChain(_chainId) {
  ethereum
    .request({
      method: "wallet_addEthereumChain",
      params: [chainInfo[_chainId].rpc],
    })
    .catch((e) => alert(e.message));
}

function init() {
  function cListNode(chainId) {
    let parent = document.createElement("div");
    tokenList[chainId].forEach((token) => {
      let div = document.createElement("div");
      div.className = "token_row";
      let html = `
      <img class="token_list_img" src="${token.logoURI}" height="25"
      width="25">
      <span class="token_list_text">${token.symbol}</span>
      <span class="token_list_name">${token.name}</span>
      `;
      div.innerHTML = html;
      div.onclick = () => selectToken(token);
      parent.appendChild(div);
    });
    chainList[chainId] = parent;
  }
  chainIds.forEach((_chainId) => cListNode(_chainId));

  let parent = document.createElement("div");
  chainIds.forEach((_chainId) => {
    let _chainInfo = chainInfo[_chainId];
    let div = document.createElement("div");
    div.className = "chain_row";
    let html = `
      <img class="token_list_img" src="${_chainInfo.src}" height="30" width="30">
      <span>${_chainInfo.name}</span>
    `;
    div.innerHTML = html;
    div.onclick = () => switchChain(_chainId);
    parent.appendChild(div);
  });
  document.getElementById("chain_body").appendChild(parent);

  myInput.onkeyup = searchToken;
  login_button.onclick = connect;
  ftNode.onclick = () => openModal("from");
  ttNode.onclick = () => openModal("to");
  faNode.onblur = async () => await getData("price", "from");
  taNode.onblur = async () => await getData("price", "to");
  exchangeB.onclick = exchangePos;
  swap_button.onclick = trySwap;
  ethereum.on("chainChanged", (_chainId) => chainIdToChain(_chainId));
  ethereum
    .request({
      method: "eth_chainId",
      params: [],
    })
    .then((_chainId) => {
      chainIdToChain(_chainId);
    })
    .catch((e) => alert(e.message));

  function match1(event) {
    const regex = /[-+e]/;
    if (event.key.match(regex) || event.target.value.length > 17)
      event.preventDefault();
  }
  taNode.addEventListener("keypress", match1, false);
  faNode.addEventListener("keypress", match1, false);

  $("#token_modal").on("hidden.bs.modal", () => {
    let div = currentChain.getElementsByTagName("div");
    for (let i = 0; i < div.length; i++) {
      div[i].style.display = "";
    }
    myInput.value = "";
  });

  let down_arrow = document.getElementById("down_arrow");
  chain_button.onclick = () => {
    if (login_button.innerHTML !== "Connected") return;
    down_arrow.style.transform = "rotate(180deg)";
    $("#chain_modal").modal("toggle");
  };
  $("#chain_modal").on(
    "hidden.bs.modal",
    () => (down_arrow.style.transform = "")
  );
  let posInfo = login_button.getBoundingClientRect();
  let left1 = posInfo.left / 2 + 25;
  let top1 = posInfo.top / 2 + 25;
  chainContent.style.left = `${left1}px`;
  chainContent.style.top = `${top1}px`;
}

init();
