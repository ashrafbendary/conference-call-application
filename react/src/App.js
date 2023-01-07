import "./App.css";
/* eslint-disable eqeqeq */
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./styles/theme";
import React from "react";
import { WebRTCAdaptor } from "./antmedia/webrtc_adaptor.js";
import { getUrlParameter } from "./antmedia/fetch.stream.js";
import { SnackbarProvider } from "notistack";
import AntSnackBar from "Components/AntSnackBar";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import i18n from "i18next";
import translationEN from "i18n/en.json";
import translationTR from "i18n/tr.json";
import CustomRoutes from "CustomRoutes";

const resources = {
  en: {
    translation: translationEN,
  },
  tr: {
    translation: translationTR,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },

    keySeperator: false,
    resources,
  });

if (i18n.language !== "en" || i18n.language !== "tr") {
  if (i18n.language.slice(0, 2) === "tr") {
    localStorage.setItem("i18nextLng", "tr");
    i18n.changeLanguage("tr");
  } else {
    localStorage.setItem("i18nextLng", "en");
    i18n.changeLanguage("en");
  }
}

var token = getUrlParameter("token");
var publishStreamId = getUrlParameter("streamId");
var playOnly = getUrlParameter("playOnly");
var subscriberId = getUrlParameter("subscriberId");
var subscriberCode = getUrlParameter("subscriberCode");
var isPlaying = false;
var fullScreenId = -1;

if (playOnly == null) {
  playOnly = false;
}

var roomOfStream = [];

var roomTimerId = -1;

function makeFullScreen(divId) {
  if (fullScreenId == divId) {
    document.getElementById(divId).classList.remove("selected");
    document.getElementById(divId).classList.add("unselected");
    fullScreenId = -1;
  } else {
    document.getElementsByClassName("publisher-content")[0].className =
      "publisher-content chat-active fullscreen-layout";
    if (fullScreenId != -1) {
      document.getElementById(fullScreenId).classList.remove("selected");
      document.getElementById(fullScreenId).classList.add("unselected");
    }
    document.getElementById(divId).classList.remove("unselected");
    document.getElementById(divId).classList.add("selected");
    fullScreenId = divId;
  }
}

var pc_config = {
  iceServers: [
    {
      urls: "stun:stun1.l.google.com:19302",
    },
  ],
};

var sdpConstraints = {
  OfferToReceiveAudio: false,
  OfferToReceiveVideo: false,
};

var mediaConstraints = {
  // setting constraints here breaks source switching on firefox.
  video: {
    width: { max: 320 },
    height: { max: 240 },
  },
  audio: true,
};

let websocketURL = process.env.REACT_APP_WEBSOCKET_URL;

if (!websocketURL) {
  const appName = window.location.pathname.substring(
    0,
    window.location.pathname.lastIndexOf("/") + 1
  );
  const path =
    window.location.hostname +
    ":" +
    window.location.port +
    appName +
    "websocket";
  websocketURL = "ws://" + path;

  if (window.location.protocol.startsWith("https")) {
    websocketURL = "wss://" + path;
  }

  websocketURL = "wss://meet.antmedia.io:5443/Conference/websocket";
}
// let streamsList;

function showPoorNetworkConnectionWarning() {
  let alertElement = document.getElementsByClassName("alert")[0];
  if (alertElement !== undefined && alertElement !== null &&alertElement.classList.contains("hide")) {
    alertElement.classList.remove("hide");
    alertElement.classList.add("show");
    alertElement.style.opacity = 1;
  }
}

function hidePoorNetworkConnectionWarning() {
  let alertElement = document.getElementsByClassName("alert")[0];
  if (alertElement !== undefined && alertElement !== null &&alertElement.classList.contains("show")) {
    alertElement.classList.remove("show");
    alertElement.classList.add("hide");
    alertElement.style.opacity = 0;
  }
}

const webRTCAdaptor = new WebRTCAdaptor({
  websocket_url: websocketURL,
  mediaConstraints: mediaConstraints,
  peerconnection_config: pc_config,
  sdp_constraints: sdpConstraints,
  isPlayMode: playOnly,
  debug: true,
  callback: (info, obj) => {
    if (info === "initialized") {
    } else if (info === "joinedTheRoom") {
      var room = obj.ATTR_ROOM_NAME;
      roomOfStream[obj.streamId] = room;

      publishStreamId = obj.streamId;

      webRTCAdaptor.handleSetMyObj(obj);
      // streamDetailsList = obj.streamList;

      webRTCAdaptor.handlePublish(
        obj.streamId,
        token,
        subscriberId,
        subscriberCode
      );

      roomTimerId = setInterval(() => {
        webRTCAdaptor.handleRoomInfo(publishStreamId);
      }, 5000);
    } else if (info === "newStreamAvailable") {
      webRTCAdaptor.handlePlayVideo(obj, publishStreamId);
    } else if (info === "publish_started") {
      //stream is being published
      webRTCAdaptor.enableStats(publishStreamId);
      webRTCAdaptor.handleRoomInfo(publishStreamId);
    } else if (info === "publish_finished") {
      //stream is being finished
    } else if (info === "screen_share_stopped") {
      webRTCAdaptor.handleScreenshareNotFromPlatform();
    } else if (info === "browser_screen_share_supported") {
    } else if (info === "leavedFromRoom") {
      hidePoorNetworkConnectionWarning();
      room = obj.ATTR_ROOM_NAME;
      if (roomTimerId !== null) {
        clearInterval(roomTimerId);
      }
    } else if (info === "closed") {
      if (typeof obj !== "undefined") {
        hidePoorNetworkConnectionWarning();
      }
    } else if (info === "play_finished") {
      hidePoorNetworkConnectionWarning();
      isPlaying = false;
    } else if (info === "streamInformation") {
      webRTCAdaptor.handleStreamInformation(obj);
    } else if (info === "screen_share_started") {
      webRTCAdaptor.screenShareOnNotification();
    } else if (info === "roomInformation") {
      var tempList = [...obj.streams];
      tempList.push("!" + publishStreamId);
      webRTCAdaptor.handleRoomEvents(obj);
      if (!isPlaying) {
        webRTCAdaptor.handlePlay(token, tempList);
        isPlaying = true;
      }
      //Lastly updates the current streamlist with the fetched one.
    } else if (info === "data_channel_opened") {
      setInterval(() => {
        webRTCAdaptor.updateStatus(obj);
      }, 2000);

      // isDataChannelOpen = true;
    } else if (info === "data_channel_closed") {
      // isDataChannelOpen = false;
    } else if (info === "data_received") {
      try {
        webRTCAdaptor.handleNotificationEvent(obj);
      } catch (e) {}
    } else if (info === "available_devices") {
      webRTCAdaptor.devices = obj;
    } else if (info === "updated_stats") {
      console.log("Average outgoing bitrate " + obj.averageOutgoingBitrate + " kbits/sec"
          + " Current outgoing bitrate: " + obj.currentOutgoingBitrate + " kbits/sec"
          + " video source width: " + obj.resWidth + " video source height: " + obj.resHeight
          + "frame width: " + obj.frameWidth + " frame height: " + obj.frameHeight
          + " video packetLost: "  + obj.videoPacketsLost + " audio packetsLost: " + obj.audioPacketsLost
          + " video RTT: " + obj.videoRoundTripTime + " audio RTT: " + obj.audioRoundTripTime
          + " video jitter: " + obj.videoJitter + " audio jitter: " + obj.audioJitter);
      let rtt = ((parseFloat(obj.videoRoundTripTime) + parseFloat(obj.audioRoundTripTime)) / 2).toPrecision(3);
      let packetLost = parseInt(obj.videoPacketsLost) + parseInt(obj.audioPacketsLost);
      let jitter = ((parseFloat(obj.videoJitter) + parseInt(obj.audioJitter)) / 2).toPrecision(3);
      let outgoingBitrate = parseInt(obj.currentOutgoingBitrate);
      let bandwidth = parseInt(webRTCAdaptor.mediaManager.bandwidth);

      if (rtt >= 150 || packetLost >= 2.5 || jitter >= 80 || ((outgoingBitrate/100) * 80) >= bandwidth || true) {
        showPoorNetworkConnectionWarning();
      } else {
        hidePoorNetworkConnectionWarning();
      }
    }
  },
  callbackError: function (error, message) {
    //some possible errors, NotFoundError, SecurityError,PermissionDeniedError
    if (error.indexOf("publishTimeoutError") !== -1 && roomTimerId != null) {
      clearInterval(roomTimerId);
    }

    var errorMessage = JSON.stringify(error);
    if (typeof message != "undefined") {
      errorMessage = message;
    }
    errorMessage = JSON.stringify(error);
    if (error.indexOf("NotFoundError") !== -1) {
      errorMessage =
        "Camera or Mic are not found or not allowed in your device.";
      alert(errorMessage);
    } else if (
      error.indexOf("NotReadableError") !== -1 ||
      error.indexOf("TrackStartError") !== -1
    ) {
      errorMessage =
        "Camera or Mic is being used by some other process that does not not allow these devices to be read.";
      alert(errorMessage);
    } else if (
      error.indexOf("OverconstrainedError") != -1 ||
      error.indexOf("ConstraintNotSatisfiedError") != -1
    ) {
      errorMessage =
        "There is no device found that fits your video and audio constraints. You may change video and audio constraints.";
      alert(errorMessage);
    } else if (
      error.indexOf("NotAllowedError") != -1 ||
      error.indexOf("PermissionDeniedError") != -1
    ) {
      errorMessage = "You are not allowed to access camera and mic.";
      webRTCAdaptor.handleScreenshareNotFromPlatform();
    } else if (error.indexOf("TypeError") != -1) {
      errorMessage = "Video/Audio is required.";
    } else if (error.indexOf("UnsecureContext") != -1) {
      errorMessage =
        "Fatal Error: Browser cannot access camera and mic because of unsecure context. Please install SSL and access via https";
    } else if (error.indexOf("WebSocketNotSupported") != -1) {
      errorMessage = "Fatal Error: WebSocket not supported in this browser";
    } else if (error.indexOf("no_stream_exist") != -1) {
      //TODO: removeRemoteVideo(error.streamId);
    } else if (error.indexOf("data_channel_error") != -1) {
      errorMessage = "There was a error during data channel communication";
    } else if (error.indexOf("ScreenSharePermissionDenied") != -1) {
      errorMessage = "You are not allowed to access screen share";
      webRTCAdaptor.handleScreenshareNotFromPlatform();
    } else if (error.indexOf("WebSocketNotConnected") != -1) {
      errorMessage = "WebSocket Connection is disconnected.";
    }

    hidePoorNetworkConnectionWarning();
    alert(errorMessage);
  },
});

function getWindowLocation() {
  document.getElementById("locationHref").value = window.location.href;
}

function copyWindowLocation() {
  var copyText = document.getElementById("locationHref");

  /* Select the text field */
  copyText.select();
  copyText.setSelectionRange(0, 99999); /* For mobile devices */

  /* Copy the text inside the text field */
  document.execCommand("copy");
}

window.getWindowLocation = getWindowLocation;
window.copyWindowLocation = copyWindowLocation;
window.makeFullScreen = makeFullScreen;

export const AntmediaContext = React.createContext(webRTCAdaptor);

function App() {
  const handleFullScreen = (e) => {
    if (e.target?.id === "meeting-gallery") {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  React.useEffect(() => {
    window.addEventListener("dblclick", handleFullScreen);

    // cleanup this component
    return () => {
      window.removeEventListener("dblclick", handleFullScreen);
    };
  }, []);
  // "#d2c8f1", "#323135", "#000", "#1b1b1b", "white"
  return (
    <ThemeProvider theme={theme()}>
      <CssBaseline />
      <SnackbarProvider
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        maxSnack={3}
        content={(key, notificationData) => (
          <AntSnackBar id={key} notificationData={notificationData} />
        )}
      >
        <AntmediaContext.Provider value={webRTCAdaptor}>
          <CustomRoutes />
        </AntmediaContext.Provider>
      </SnackbarProvider>
      <div className="alert hide">
        <span className="fas fa-exclamation-circle"></span>
        <span className="msg">Connection is not stable. Please check your internet connection!</span>
      </div>
    </ThemeProvider>
  );
}

export default App;
