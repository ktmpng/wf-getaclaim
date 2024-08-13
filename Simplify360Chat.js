// window['console'] = { log: function () { } };
let chatPosition = localStorage.getItem("chatPosition") || "right";
const deviceViewedOn = window.matchMedia("(max-width:481px)").matches ? "mobile" : "desktop";
let fixed_height = "5rem";

console.log(deviceViewedOn, "deviceViewedOn")
// eslint-disable-next-line no-unused-vars
const Simplify360Chat = (function () {
  let Simplify360Chat = {};
  // console.log = function () { }
  let chatStatus = "closed";
  let prevUrl = "";
  Simplify360Chat.prototype = {};
  let tempComfigId = "";
  let scripts = document.getElementsByTagName("script");
  let tempIntroMessage = null;

  // localhost environment
  // let S360ChatURL = "http://localhost:3000";

  // dev environment
  // let S360ChatURL = "https://d64a1lba9ehmz.cloudfront.net";

  // backupNextiva and Nextiva environment
  let S360ChatURL = "https://d4cq8fw7kph8i.cloudfront.net"

  // backupIn and India DC environment
  // let S360ChatURL = "https://d2dptbxixuytue.cloudfront.net";

  // suitex
  // let S360ChatURL = "https://d3d4dbuszlq8f7.cloudfront.net";

  window.onload = async function () {
    const URL = S360ChatURL.includes("localhost") ? "http://localhost:3000" : S360ChatURL;

    let linkForCss = `${URL}/simplify360Style.css`;
    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = linkForCss;
    document.head.appendChild(link);

    for (let i = 0; i < scripts.length; i++) {
      let scriptSrc = scripts[i].getAttribute("src");

      // Check if the script source contains "/Simplify360Chat.js?key="
      if (scriptSrc && scriptSrc.indexOf("/Simplify360Chat.js?key=") !== -1) {
        await extractConfig();
        break;
      }
    }
    if (isWebAppInitialized()) {
      showChatIFrame();
      //set browser history in local storage
      let browseHistory = [];
      prevUrl = window.location.href;
      localStorage.setItem("browseHistory", JSON.stringify(browseHistory));
      let currentPagePath = window.location.href;
      logBrowswerHistoryData(currentPagePath);
    }
  };

  const extractConfig = async () => {
    let targetScript;
    for (let i = 0; i < scripts.length; i++) {
      let scriptSrc = scripts[i].getAttribute("src");
      // Check if the script source contains "/Simplify360Chat.js?key="
      if (scriptSrc && scriptSrc.indexOf("/Simplify360Chat.js?key=") !== -1) {
        targetScript = scripts[i];
        break;
      }
    }

    if (targetScript) {
      // Extract the "key" parameter value from the script source
      let src = targetScript.getAttribute("src");
      let keyMatch = src.match(/key=([^&]+)/);
      if (keyMatch) {
        let keyParameter = keyMatch[1];
        console.log("Value of key parameter: " + keyParameter);

        await launchConfigFromKey(keyParameter);
      } else {
        console.log("Key parameter not found in the script source URL.");
      }
    } else {
      console.log("Script tag not found with the specified src.");
    }
  };

  const isWebAppInitialized = () => {
    return localStorage.getItem(`s360-config-data-${tempComfigId}`) != null;
  };

  const convertClientTime = (configTimezone) => {
    const date = new Date();
    return new Date(date.toLocaleString("en-US", { timeZone: configTimezone }));
  };

  const isOfflineTime = (config, convertedTime) => {
    const isHoliday = config?.holidays.find(holiday => {
      const holidayDate = new Date(holiday?.day);
      holidayDate.setHours(0, 0, 0);

      const currentDate = new Date(convertedTime.valueOf());
      currentDate.setHours(0, 0, 0);

      if (holidayDate.getTime() === currentDate.getTime()) {
        return holiday;
      }
    });

    const currentTime = new Date(convertedTime.valueOf());

    const constructCurrentDate = (time) => {
      time = time.split(':');
      return new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(),
        parseInt(time[0]), parseInt(time[1]), parseInt(time[2]));
    }

    if (isHoliday) {
      const startTime = constructCurrentDate(isHoliday?.holiday_start);
      const endTime = constructCurrentDate(isHoliday?.holiday_end);

      if (currentTime >= startTime && currentTime <= endTime) {
        return true;
      }
    } else {
      const workingDayShifts = config?.workingHours.filter(workingDay => workingDay.dayOfWeek === currentTime.getDay());
      let isCurrentlyInShift = true;
      if (workingDayShifts.length) {
        for (let workingDayShift of workingDayShifts) {
          const workShiftStartTime = constructCurrentDate(workingDayShift?.workHourStart);
          const workShiftEndTime = constructCurrentDate(workingDayShift?.workHourEnd);

          isCurrentlyInShift = currentTime >= workShiftStartTime && currentTime <= workShiftEndTime;
          if (isCurrentlyInShift) {
            break;
          }
        }
      }

      return !isCurrentlyInShift;
    }

    return false;
  }

  const launchConfigFromKey = async (configKey) => {
    const URL = S360ChatURL.includes("localhost") ? "http://localhost:3030" : S360ChatURL;

    await fetch(`${URL}/liveChatConfig/${configKey}/${configKey}.json`)
      .then((res) => res.json())
      .then(async (config) => {
        localStorage.setItem(`s360-config-data-${config?.configId}`, JSON.stringify(config));

        if (config && config?.configDetails?.showForm) {
          await fetch(`${URL}/liveChatConfig/${configKey}/${configKey}_form.json`).then((res) => res.json()).then((form) => {
            config = {
              ...config,
              ...form,
              configDetails: { ...config.configDetails, ...form.configDetails },
            };
          });
        }

        if (config && config?.configDetails?.enableBusinessHours) {
          await fetch(`${URL}/liveChatConfig/${configKey}/${configKey}_calendar.json`).then((res) => res.json()).then((calendar) => {
            config = {
              ...config,
              ...calendar,
              configDetails: { ...config.configDetails, ...calendar.configDetails },
            };
          });
        }
        return config;
      })
      .then((updatedConfig) => update(updatedConfig));
  };

  const init = (config) => {
    console.log(config, "config111")
    chatPosition = config?.chatPosition?.horizontal;
    localStorage.setItem("chatPosition", chatPosition);
    if (!config || !config.token) {
      console.log("Please configure the Simplify 360 SDK.");
      return;
    }
    let configId = config.configId;
    tempComfigId = configId;
    if (config.configDetails?.introductionMessage !== undefined) {
      tempIntroMessage = config.configDetails?.introductionMessage;
    }

    localStorage.setItem(`s360-config-data-${configId}`, JSON.stringify(config));
    localStorage.setItem("user-agent", JSON.stringify(window.navigator.userAgent));
    localStorage.setItem("lastConfigID", configId);
    localStorage.setItem("location", window.location.href);
    console.log("Configured!!");
    showChatIFrame();
    console.log(config.configDetails?.introductionMessage, "config?.configDetails")
  };

  const update = (changedConfig) => {
    if (changedConfig.configDetails?.introductionMessage !== undefined) {
      tempIntroMessage = changedConfig.configDetails?.introductionMessage;
    }
    // let isAnonymous = changedConfig?.anonymous;
    disableIntroMessageOnEmtyMessage(tempIntroMessage);
    if (changedConfig.autoPopup) {
      chatStatus = "opened";
    } else {
      onChatClose();
    }

    if (document?.getElementById("s360-chat-iframe")?.offsetHeight < 200 && changedConfig.configDetails?.introductionMessage) {
      updateIntroductionMessage(changedConfig.configDetails?.introductionMessage);
    }

    if (changedConfig?.configDetails?.enableBusinessHours && (!!changedConfig?.holidays?.length || !!changedConfig?.workingHours?.length)) {
      const configuredTimezone = changedConfig?.timezone;
      const convertedTime = convertClientTime(configuredTimezone);
      let offline = isOfflineTime(changedConfig, convertedTime);
      changedConfig.configDetails.offline = offline ?? false;
      changedConfig.anonymous = changedConfig.configDetails.offline ? false : changedConfig?.anonymous;
    }

    if (!isChatIFrameOpen) {
      init(changedConfig);
    } else {
      console.log(changedConfig, "changedConfig");
      postMessageToIframe(changedConfig, "on-config-data-update");
      if (changedConfig.chatPosition?.horizontal !== undefined || changedConfig.chatPosition?.vertical !== undefined) {
        chatPosition = changedConfig.chatPosition?.horizontal;
        localStorage.setItem("chatPosition", chatPosition);
        changeChatPosition(changedConfig.chatPosition);
      }
    }
    //send a postiframemessage with config
  };

  const requestNotificationPermission = () => {
    Notification.requestPermission();
  }

  const logBrowswerHistoryData = (location) => {
    prevUrl = location;
    let history = localStorage.getItem("browseHistory");
    let browseHistory = JSON.parse(history);
    browseHistory.unshift(location);
    if (browseHistory.length > 5) browseHistory.pop();
    //return array
    localStorage.setItem("browseHistory", JSON.stringify(browseHistory));
  };
  // MARK: Set User
  const setUser = (userDetails) => {
    if (!userDetails) {
      console.log("Invalid User Details");
    }
    if (!isWebAppInitialized()) {
      console.log("Call configure before logging user data.");
      return;
    }
    let userDataString = null;
    try {
      userDataString = JSON.stringify(userDetails);
    } catch (error) {
      console.log("Invalid User Details");
      return;
    }
    if (Object.keys(userDataString).length !== 0) {
      localStorage.setItem("s360-chat-user-info", userDataString);
      let userData = getCurrentUser();
      if (userData) {
        postMessageToIframe(userData, "on-set-user-config");
      }
    }
  };

  const triggerNotification = (notificationMessage) => {
    console.log("notification getiing triggered....", notificationMessage)
    const config = getConfig();
    if (config?.configDetails?.browserNotification && Notification.permission === "granted") {
      new Notification(notificationMessage);
    }
  };

  // MARK: Reset User
  const resetUser = () => {
    if (!isWebAppInitialized()) {
      console.log("Call configure before resetting user data.");
      return;
    }

    localStorage.removeItem("s360-chat-user-info");
    postMessageToIframe(null, "on-reset-user");
  };


  const getConfig = () => {
    let config = localStorage.getItem(`s360-config-data-${tempComfigId}`);

    return config ? JSON.parse(config) : null;
  };

  const getCurrentUser = () => {
    let userJSONString = localStorage.getItem("s360-chat-user-info");
    if (!userJSONString) {
      return null;
    }
    return JSON.parse(userJSONString);
  };

  const showChatIFrame = () => {
    let configTokenData = {
      sourceOrigin: document.location.origin,
      clientHostId: getClientHostId(),
    };
    let configTokenJSON = encodeChatToken(configTokenData);
    let params = { configToken: configTokenJSON };

    let urlPath = S360ChatURL + "/" + JSON.stringify(Object.keys(params).map(key => params[key]).join("/"));
    urlPath = urlPath.replace(/"/g, "");
    openIframeWithURL(urlPath);
  };

  let isChatIFrameOpen = false;
  const openIframeWithURL = (urlToOpen) => {
    if (isChatIFrameOpen === true) {
      console.log("Chat Already Displayed: ");
      postMessageToIframe(null, "chat-maximize");
      return;
    }
    let iconHeight = "4.5rem";
    //calc(100vh - 6rem)
    let chat_inner_html =
      `<div id="s360-startup-float-message-container-id"  style="position: absolute;top: -5rem; width:40%;display:flex;">
        <span 
          id="s360-startup-float-message-id" 
          style="font-family:Lato, sans-serif; display: flex; max-width: 65%; max-height: 104px; padding: 16px; align-items: flex-start;gap: 8px;border-radius: 8px;background: #FFF;box-shadow: 0 2px 16px 0 rgba(34, 38, 72, 0.30);position:absolute;bottom:${iconHeight};right: 1em;font-size: 14px;overflow:hidden;word-break: break-all;">
        </span>
      </div>
      <iframe id="s360-chat-iframe" name="s360chatiframe" allow="microphone" scrolling="no" background-color: transparent; frameborder="0"
      style="position: fixed; bottom: 0;right:0; -webkit-transition: all 0.3s;-moz-transition: all 0.3s;-ms-transition: all 0.3s;-o-transition: all 0.3s;transition: all 0.3s;"
      src=${urlToOpen} allowFullScreen="true" webkitallowfullscreen="true"  mozallowfullscreen="true" > 
      </iframe>`;

    // console.log(chat_inner_html);
    let s360_chat_div_element = document.createElement("div");
    s360_chat_div_element.innerHTML = chat_inner_html;
    s360_chat_div_element.id = "s360-chat-iframe-container";
    //s360_chat_div_element.style = "position: fixed; top: 0px;bottom: 0px;left:0px;right:0px;width: 100%;height: 100%; background: rgba(255,255,255,0.5);z-index:9999";
    subscribeToIframe();

    if (document.body) {
      document?.body?.appendChild(s360_chat_div_element);
      isChatIFrameOpen = true;
      onChatClose();
    }
    updateIntroductionMessage(tempIntroMessage)
  };

  const postMessageToIframe = (messageData, actionName) => {
    //STEP 6
    console.log("posting message", actionName);
    try {
      let message = {
        clientHostId: getClientHostId(),
        action: actionName,
        data: messageData,
      };
      let winFrame = window.frames.s360chatiframe;
      // console.log("message", message);
      winFrame.postMessage(JSON.stringify(message), S360ChatURL);
    } catch (error) {
      // console.warn(error);
    }
  };

  // Iframe Brigde
  const subscribeToIframe = () => {
    console.log("subscribed");

    window.addEventListener("message", onNewMessage, false);
  };

  document.addEventListener("click", function () {
    let currentPagePath = window.location.href;
    if (currentPagePath && prevUrl && currentPagePath !== prevUrl) {
      logBrowswerHistoryData(currentPagePath);
    }
  });
  window.addEventListener("message", function (event) {
    if (event.data.resetFromNewButton === "true") {
      onResetUserAndOpenChat();
    } else if (event.data.fullScreen === "true") {
      fullScreenChatWindow();
    } else if (event.data.closeFunctionFullScreen === "true") {
      window.parent.parentFunction();
    }
  });

  const fullScreenChatWindow = () => {
    let chatFrame = window.document.getElementById("s360-chat-iframe");
    if (chatFrame) {
      chatFrame.style =
        "position: fixed;width: 100% !important;height:100% !important;bottom: 0;right:0;overflow: visible;z-index: 999999999;left:0;";
    }
  };
  const updateIntroductionMessage = (message) => {
    let toolTip = document.getElementById(
      "s360-startup-float-message-container-id"
    );
    if (toolTip) {
      toolTip.style.display = "flex";
      toolTip.style.zIndex = "999999999999999";
    }


    let chatTooltip = window.document.getElementById(
      "s360-startup-float-message-container-id"
    );

    if (chatTooltip && message) {
      updateTooltipUIIntroMessage(message);
    }
  };

  const changeChatPosition = () => {
    console.log(chatPosition, "chatPosition")
    let chatFrame = window.document.getElementById("s360-chat-iframe");
    let chatToolTip = window.document.getElementById(
      "s360-startup-float-message-container-id"
    );
    let chatToolTipInside = document.getElementById(
      "s360-startup-float-message-id"
    );

    if(deviceViewedOn === "mobile"){
      fixed_height = "7rem";
    }

    if (chatFrame) {
      chatFrame.style = `position: fixed;${chatStatus === "closed" ? ' top: calc(100vh - 6rem)' : `bottom:1rem;`};${chatPosition}:0;overflow: visible;z-index: 99999;HEIGHT:${chatStatus === "closed" ? fixed_height : "100%"
      };width:${chatStatus === "closed" ? "100" : "100%"}; max-width:${deviceViewedOn === "mobile" ? '100%' : '24rem'}; -webkit-transition: all 0.3s;-moz-transition: all 0.3s;-ms-transition: all 0.3s;-o-transition: all 0.3s;transition: all 0.3s;`;
    }

    if (chatToolTip && chatPosition === "left" && chatStatus === "closed") {
      chatToolTip.style = `postion:absolute;bottom:0;width:20%`;
      chatToolTipInside.style = `font-family:Lato; display:${tempIntroMessage === null || tempIntroMessage === "" ? "none" : "flex"
      }; max-width: 45%;max-height: 104px;padding: 16px;align-items: flex-start;gap: 8px; border-radius: 8px;background: let(--white, #FFF);box-shadow: 0px 2px 16px 0px rgba(34, 38, 72, 0.30);position:absolute;bottom:4.5rem;left:1em;font-size: 14px;overflow:hidden;word-break: break-all;`;
    }
    if (chatToolTip && chatPosition === "right" && chatStatus === "closed") {

      chatToolTip.style = `postion:absolute;bottom:0;width:20%`;
      chatToolTipInside.style = "font-family:Lato; max-width: 45%;max-height: 104px;padding: 16px;align-items: flex-start;gap: 8px; border-radius: 8px;background: let(--white, #FFF);box-shadow: 0px 2px 16px 0px rgba(34, 38, 72, 0.30);position:absolute;bottom:4.5rem;right:1em;font-size: 14px;overflow:hidden;word-break:break-all;";
      chatToolTipInside.style.display = tempIntroMessage === null || tempIntroMessage === "" ? "none" : "flex";
      chatToolTip.style.display = tempIntroMessage === null || tempIntroMessage === "" ? "none" : "flex";

    }

    if (chatStatus === "opened") {
      if (chatToolTip) { chatToolTip.style.display = "none"; }
    }
    console.log(chatToolTip, tempIntroMessage, "here123")
  };

  const onResetUserAndOpenChat = () => {
    if (!isWebAppInitialized()) {
      console.log("Call configure before resetting user data.");
      return;
    }
    localStorage.removeItem("s360-chat-user-info");
    postMessageToIframe(null, "on-reset-user");
  };

  const onNewMessage = function onMessage(messageEvent) {
    if (messageEvent.origin !== S360ChatURL) {
      return;
    }
    try {
      let messageData = JSON.parse(messageEvent.data);
      switch (messageData.action) {
        case "update-client-host-config":
          //STEP 4
          onUpdateClientHostConfigData();
          break;
        case "on-app-open":
          onChatOpen();
          break;
        case "on-app-close":
          onChatClose();
          break;
        case "reset-user-iframe":
          resetUser();
          break;
        case "set-user":
          setUser();
          break;
        case "load-local-user":
          setUser(JSON.parse(localStorage.getItem("s360-chat-user-info")));
          break;
        case "request-notification":
          requestNotificationPermission();
          break;
        case "notification":
          triggerNotification(messageData.data);
          break;
        default:
          break;
      }
    } catch (error) {
      console.log("Invalid Message : ", error);
    }
  };

  const onUpdateClientHostConfigData = () => {
    //STEP 5
    if (!isWebAppInitialized()) {
      return;
    }
    let s360Config = getConfig();
    if (s360Config) {
      postMessageToIframe(s360Config, "on-config-data-update");
      updateTooltipUIIntroMessage();
    } else {
      console.log("No config available to send");
    }
  };

  const updateTooltipUIIntroMessage = () => {
    if (chatStatus === "opened") {
      return;
    }
    let toolTip = document.getElementById(
      "s360-startup-float-message-container-id"
    );
    let chatTooltipMessage = window.document.getElementById(
      "s360-startup-float-message-id"
    );
    if (chatTooltipMessage && tempIntroMessage) {
      chatTooltipMessage.style.display = "flex";
      chatTooltipMessage.style.overflow = "hidden";
      chatTooltipMessage.style.wordBreak = "break-all";
      toolTip.style.display = "flex";
      chatTooltipMessage.innerHTML = tempIntroMessage;
    } else {
      console.log("introMessage", chatTooltipMessage, tempIntroMessage, chatStatus);
      chatTooltipMessage.innerHTML = "";

      toolTip.style.display = "none";
      toolTip.style.transition = "opacity 1s ease-out";
    }
  };


  const onChatOpen = () => {
    let s360Config = getConfig();

    document.getElementById('s360-chat-iframe').style.height = '100%';

    console.log('Chat Opened');
    let chatFrame = window.document.getElementById("s360-chat-iframe");
    if (chatFrame) {
      let mq = window.matchMedia("(max-width:481px)");
      // console.log(mq);
      if (mq.matches) {
        chatFrame.style =
          "position: fixed;width: 100%;height:100%!important;bottom: 0;right:0;overflow: visible;z-index: 99999; -webkit-transition: all 0.3s;-moz-transition: all 0.3s;-ms-transition: all 0.3s;-o-transition: all 0.3s;transition: all 0.3s; top: -5rem;";
      } else {
        // let height = window.screen.height * 0.75 + 110;
        //note::max-height:750px;
        chatFrame.style = `position: fixed; display: flow-root;width: 100%; max-width:${deviceViewedOn === "mobile" ? '100%' : '24rem'};  height:100%!important;${chatPosition}:0;bottom:0;overflow: visible;z-index: 99999; -webkit-transition: all 0.3s;-moz-transition: all 0.3s;-ms-transition: all 0.3s;-o-transition: all 0.3s;transition: all 0.3s; top: -5rem;`;
        //chatFrame.style = "position: fixed; display: flow-root;width: 446px; height:calc(100% - 100px);max-height:100%;right: 0;bottom: 0;overflow: visible;margin-right:5px;z-index: 999999999;"
      }
      if (
        s360Config.chatWidth !== undefined &&
        s360Config.chatHeight !== undefined
      ) {
        // console.log("mq.matches", mq.matches)
        if (mq.matches) {
          chatFrame.style = `position: fixed;width: 100%;height:100%;bottom: 0;${chatPosition}:0;overflow: visible;z-index: 99999; -webkit-transition: all 0.3s;-moz-transition: all 0.3s;-ms-transition: all 0.3s;-o-transition: all 0.3s;transition: all 0.3s; top: -5rem;`;
        } else {
          chatFrame.style.height = `${s360Config.chatHeight}px`;
          chatFrame.style.width = `${s360Config.chatWidth}px`;
        }
      }
    }
    let chatTooltip = window.document.getElementById(
      "s360-startup-float-message-container-id"
    );
    if (chatTooltip) {
      chatTooltip.style.display = "none";
      chatTooltip.style.transition = "opacity 1s ease-out";
      chatStatus = "opened";
      updateTooltipUIIntroMessage();
      postMessageToIframe(
        {
          autoPopup: true,
          chatPosition: {
            // horizontal: chatPosition || "right",
            horizontal: "top",
          },
        },
        "on-config-data-update"
      );
    }

    //get browse history data from local storage.

    let history = localStorage.getItem("browseHistory");
    let browseHistory = JSON.parse(history);
    // console.log("bb", browseHistory);
    let userData = getUserAgentInfo();
    // console.log("tt", userData);
    let ip = localStorage.getItem("ip");
    let userDetails = {
      history: browseHistory,
      ip: ip,
      browser: userData.browserName,
      os: userData.Os,
    };
    // console.log("rr", userDetails);
    postMessageToIframe(userDetails, "on-update-user-metadata");
    changeChatPosition(chatPosition);
  };

  const disableIntroMessageOnEmtyMessage = () => {
    let introMessage = tempIntroMessage;
    console.log(introMessage, "introMessage");
    if (introMessage === undefined || introMessage === "") {
      let chatTooltipMessage = window.document.getElementById(
        "s360-startup-float-message-id"
      );
      let toolTip = document.getElementById(
        "s360-startup-float-message-container-id"
      );
      if (chatTooltipMessage && toolTip) {
        chatTooltipMessage.style.display = "none";
        toolTip.style.display = "none";
        toolTip.style.transition = "opacity 1s ease-out";
      }
    }
  };
  const onChatClose = () => {
    chatStatus = "closed";
    let introMessage = tempIntroMessage;
    

    let chatFrame = window.document.getElementById("s360-chat-iframe");

    //document.getElementById('s360-chat-iframe').style.height = '100%';
    
    if (chatFrame) {

      if(deviceViewedOn === "mobile"){
        fixed_height = "7rem";
      }

      chatFrame.style.height = fixed_height;
      chatFrame.style = `position: fixed;top:calc(100vh - 6rem);${chatPosition}:0; overflow: visible;z-index: 99999;height:${chatStatus === "closed" ? fixed_height : "100%"
      };width:${chatStatus === "closed" ? "auto" : "100"
      };max-width:${deviceViewedOn === "mobile" ? '100%' : '24rem'}; -webkit-transition: all 0.3s;-moz-transition: all 0.3s;-ms-transition: all 0.3s;-o-transition: all 0.3s;transition: all 0.3s; `;
    }
    let chatTooltip = window.document.getElementById(
      "s360-startup-float-message-container-id"
    );

    if (chatTooltip && introMessage) {


      updateTooltipUIIntroMessage(introMessage);
    }


    changeChatPosition(chatPosition);
    disableIntroMessageOnEmtyMessage();
  };

  const encodeChatToken = function (configTokenObject) {
    let configString = JSON.stringify(configTokenObject);
    return encodeURIComponent(btoa(configString));
  };

  const generateUUIDV4 = function () {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        let r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  };

  const configureClientHostId = function () {
    if (!getClientHostId()) {
      localStorage.setItem("s360-client-host-id", generateUUIDV4());
    }
  };

  const getClientHostId = function () {
    return localStorage.getItem("s360-client-host-id");
  };

  configureClientHostId();


  const getUserAgentInfo = () => {
    // let nVer = navigator.appVersion;
    let userAgent = navigator.userAgent;
    let browserName = navigator.appName;
    let fullVersion = "" + parseFloat(navigator.appVersion);
    let nameOffset, verOffset, ix;

    //Get OS

    let e = userAgent.indexOf(")");
    let i = userAgent.indexOf(";");
    let Os = userAgent.substring(i + 1, e);

    // In Opera, the true version is after "Opera" or after "Version"
    if ((verOffset = userAgent.indexOf("Opera")) !== -1) {
      browserName = "Opera";
      fullVersion = userAgent.substring(verOffset + 6);
      if ((verOffset = userAgent.indexOf("Version")) !== -1)
        fullVersion = userAgent.substring(verOffset + 8);
    }
    // In MSIE, the true version is after "MSIE" in userAgent
    else if ((verOffset = userAgent.indexOf("MSIE")) !== -1) {
      browserName = "Microsoft Internet Explorer";
      fullVersion = userAgent.substring(verOffset + 5);
    }
    // In Chrome, the true version is after "Chrome"
    else if ((verOffset = userAgent.indexOf("Chrome")) !== -1) {
      browserName = "Chrome";
      fullVersion = userAgent.substring(verOffset + 7);
    }
    // In Safari, the true version is after "Safari" or after "Version"
    else if ((verOffset = userAgent.indexOf("Safari")) !== -1) {
      browserName = "Safari";
      fullVersion = userAgent.substring(verOffset + 7);
      if ((verOffset = userAgent.indexOf("Version")) !== -1)
        fullVersion = userAgent.substring(verOffset + 8);
    }
    // In Firefox, the true version is after "Firefox"
    else if ((verOffset = userAgent.indexOf("Firefox")) !== -1) {
      browserName = "Firefox";
      fullVersion = userAgent.substring(verOffset + 8);
    }
    // In most other browsers, "name/version" is at the end of userAgent
    else if ((nameOffset = userAgent.lastIndexOf(" ") + 1) < (verOffset = userAgent.lastIndexOf("/"))) {
      browserName = userAgent.substring(nameOffset, verOffset);
      fullVersion = userAgent.substring(verOffset + 1);
      if (browserName.toLowerCase() === browserName.toUpperCase()) {
        browserName = navigator.appName;
      }
    }
    // trim the fullVersion string at semicolon/space if present
    if ((ix = fullVersion.indexOf(";")) !== -1)
      fullVersion = fullVersion.substring(0, ix);
    if ((ix = fullVersion.indexOf(" ")) !== -1)
      fullVersion = fullVersion.substring(0, ix);

    let majorVersion = parseInt("" + fullVersion, 10);
    if (isNaN(majorVersion)) {
      fullVersion = "" + parseFloat(navigator.appVersion);
      majorVersion = parseInt(navigator.appVersion, 10);
    }

    return {
      browserName: browserName,
      fullVersion: fullVersion,
      majorVersion: majorVersion,
      Os: Os,
    };
  };

  return {
    init: init,
    setUser: setUser,
    resetUser: resetUser,
    showChatIFrame: showChatIFrame,
    subscribeToIframe: subscribeToIframe,
    update: update,
  };
})();
