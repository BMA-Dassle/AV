/**
 * fxApp.js 6.7.0
 * Code library for Designer apps`
 * http://allonis.com/`
 *
 * Copyright (c) 2015-Ad Infinitum Allonis LLC
 *
 * Not for public release. You are not allowed to resuse this software
 * for personal or commercial reasons outside of the Allonis eco-system.
 *
 */
"use strict";

class AppCore {
   constructor() {
      this.settings = {
        RememberLastPage: false,
        EnableSSL: false,
        EnableSmartRemote: false,
        EnableAppScaling: false,
        EnableDesktopScaling: false,
        EnableAppScrolling: true,
        DesignWidth: 1366,
        DesignHeight: 999,
        MinScaleFactor: 0.5,
        MaxScaleFactor: 2.0
      };
      this._activeValues = ",1,on,true,visible,enabled,closed,yes,debugging,violated";
      this._windows = {};
      this.UPDATEFREQ = 2500;
      this.HOMEPAGE = '/';  
      this._designWidth = window.innerWidth;
      this._designHeight = window.innerHeight;
      this._homePage = "/";
      this._designMode = false;
      this._longpress = false;
      this._numlock = false;
      this._clientName =  this.readSetting("clientname", this.makeId(4, "fx-")).toLowerCase();
      this._serverIp = "";
      this._serverUrl = "";
      this._localIp = "";
      this._project = "";
      this._mainContent = null;
      this._ws = null;
      this._wsTimer = null;
      this._sbvTimer = null;
      this._localIP = null;
      this._appHistory = [];
      this._scaleFactor = 1;
      this._currentPage = "index";
      this._lastPage = "";
      this._recognizer = null;
      this._offset = 50;
      this._pageToLoad = {
        shouldLoad: false,
        project: "",
        page: ""
      };
      this.smartRemote = null;
      this.projectButtons = [];
      this.pageButtons = [];
     }

   get scaleFactor() {
      return this._scaleFactor;
   }

   get getOffset() {
      this._offset += 50;
      if (this._offset > 200) {
        this._offset = 50;
      }
      return this._offset;
   };
  
   get activeValues() {
      return this._activeValues;
   };

   get clientName() {
      return this._clientName;
   }
   set clientName(name) {
      let cname = name.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      this.writeSetting('clientname', cname.replace(/\s{2,}/g, " "));
      this._clientName = cname;
   }
  
   get designMode() {
      return this._designMode;
   }
   set designMode(state) {
      if(typeof(state) === "boolean") {
        this._designMode = state;
      } else {
        console.error("designMode [" + state + "] is not a boolean!");
      }
   }
  
   get serverIp() {
      return this._serverIp;
   }
   set serverIp(ip) {
      this._serverIP = ip
   }
  
   get localIp() {
      return this._localIp;
   }
   set localIp(ip) {
      this._localIp = ip
   }
  
   get mainContent() {
      return this._mainContent;
   }
  
   isNumeric(n) { 
      return !isNaN(parseFloat(n)) && isFinite(n);
   }
   
   isTrue = (value) => {
      if (value === null || value === undefined) {
        return false;
      }
      return (this._activeValues.indexOf(value.toLowerCase()) > 0);
   }
  
   guid = () => {
      return ((new Date()).getTime().toString(16)+Math.floor(1E7*Math.random()).toString(16));
   }
    
   makeId = (length, prefix) => {
      let result = prefix;
      const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
      const charactersLength = characters.length;
      for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      return result;
   }
   
   readSetting = (name, defaultValue) => {
      if (!this.isEmpty(localStorage.getItem(name))) {
        return localStorage.getItem(name);
      } else {
        localStorage.setItem(name, defaultValue);
        return defaultValue;
      }
   }
  
   writeSetting = (name, value) => {
      localStorage.setItem(name, value);
   }
  
   isEmpty = (value) => {
      if (value === null || value === undefined) {
        return true;
      }
      if (value.prop && value.prop.constructor === Array) {
        return value.length == 0;
      }
      if (typeof value == 'object') {
        return Object.keys(value).length === 0 && value.constructor === Object;
      }
      if (typeof value == 'string') {
        return value.length == 0;
      }
      if (!value) {
        return true;
      }
      return false;
   }
   
   isTouch = () => {
      return (('ontouchstart' in window) || (navigator.MaxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
   }
  
   isMobile = () => {
      const toMatch = [	/Android/i,/webOS/i,/iPhone/i,/iPad/i,/iPod/i,/Windows Phone/i ];
      return toMatch.some((toMatchItem) => {
        return navigator.userAgent.match(toMatchItem);
      });
   }
   
   isSignage = () => {
      const toMatch = [	/AFT/i,/Shield/i,/Tivo/i,/SM10P/i ];
      return toMatch.some((toMatchItem) => {
        return navigator.userAgent.match(toMatchItem);
      });
   }

   isiPhone = () => {
      const toMatch = [	/iPhone/i ];
      return toMatch.some((toMatchItem) => {
        return navigator.userAgent.match(toMatchItem);
      });
   }
  
   postData = async (url, data) => {
      const response = await fetch(url, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          'clientname': this._clientName
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(data)
      });
      return await response.json();
   }
  
   getJson = async (url, data="") => {
      let uri = url;
      if (!this.isEmpty(data)) {
        uri += '?' + new URLSearchParams(data);
      }
      const response = await fetch(uri, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          'clientname': this._clientName
        },
      });
      return await response.json();
   }
  
   getData = async (url, data="") => {
      let uri = url;
      if (!this.isEmpty(data)) {
        uri += '?' + new URLSearchParams(data);
      }
      const response = await fetch(uri, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          'clientname': this._clientName
        },
      });
      return await response.text();
   }
  
   getIcon = (type, icon) => {
      let ico = "";
      switch (type.toLowerCase()) {
        case "f7": {
          ico = '<i class="f7-icons">' + icon + '</i>';
          break;
        }
        case "mi": {
          ico = '<i class="material-icons">' + icon + '</i>';
          break;
        }
        case "bi": { //
          ico = '<i class="bi-' + icon + '"></i>';
          break;
        }
        case "fab": { //
          ico = '<i class="fa-brands fa-' + icon + '"></i>';
          break;
        }
        case "fal": { //
          ico = '<i class="fa-light fa-' + icon + '"></i>';
          break;
        }
        case "far": { //
          ico = '<i class="fa-regular fa-' + icon + '"></i>';
          break;
        }
        case "fas": { //
          ico = '<i class="fa-solid fa-' + icon + '"></i>';
          break;
        }
        case "fass": { //
         ico = '<i class="fa-sharp fa-solid fa-' + icon + '"></i>';
         break;
       }
       case "fasr": { //
         ico = '<i class="fa-sharp fa-regular fa-' + icon + '"></i>';
         break;
       }
       case "fat": { //
          ico = '<i class="fa-thin fa-' + icon + '"></i>';
          break;
        }
        case "fad": { //
          ico = '<i class="fa-duotone fa-' + icon + '"></i>';
          break;
        }
        case "ei": { //
          ico = '<i class="elegant-icons ei-' + icon + '"></i>';
          break;
        }
      }
      return ico;
   }
   
   restoreGlobals = () => {
      if (this.isEmpty(localStorage.getItem("clientname"))) {
        this._clientName = this.makeId(8, "");
        localStorage.setItem("clientname", this._clientName);
      } else {
        this._clientName = localStorage.getItem("clientname").toLowerCase();
        if (window.location.pathname.length > 2) {
          const parts = window.location.pathname.split('/');
          if (parts.length >= 2) {
            this._clientName = parts[1] + "-" + this._clientName;
          }
        }
      }
      this.openSocket();
   }
  
   initApp = () => {
      this._mainContent = document.querySelector(".main-content");
      if ((custom_settings != undefined) && (typeof custom_settings == 'object')) {
         this.settings = custom_settings;
      }
      this._mainContent.style.width = this.settings.DesignWidth + "px";
      this._mainContent.style.height = this.settings.DesignHeight + "px";
      if (this.isiPhone()) {
         this._mainContent.style.marginTop = "40px";
      }
      if (this._designMode === false) {
         if (this.settings.EnableSmartRemote === true) {
            this.smartRemote = new SmartRemoteCore();
            this.smartRemote.enableHardButtonEvents();
            if (window.location.href.indexOf("smartpreview") > 0) {
               this._mainContent.classList.add("main-content-designer");
               document.body.classList.add("body-designer");
               document.body.insertAdjacentHTML("afterend",'<ui-overlay index="20" content="overlay-remotebuttons-preview" visible="1"></ui-overlay>');
            }
            if (!this.isEmpty(this.settings.IsSimulation)) {
               this._mainContent.classList.add("main-content-designer");
               document.body.classList.add("body-designer");
            }
         }
         if (this.settings.EnableAppScaling === true) {
            window.addEventListener('resize', this.scaleApp);
            this.scaleApp();
         }
         if (this.settings.RememberLastPage === true) {
            const page = localStorage.getItem(this._clientName + "-page");
            if (!this.isEmpty(page)) {
               this.routeTo(page);
               return;
            }
         }
         $(this._mainContent).fadeTo(400, 1, 'linear');
      } else {
         this._mainContent.style.border = "1px dashed pink";
         if (this.settings.EnableSmartRemote === true) {
            this._mainContent.classList.add("main-content-designer");
            document.body.classList.add("body-designer");
         } else {
            this._mainContent.classList.remove("main-content-designer");
            document.body.classList.remove("body-designer");
            this._mainContent.style.marginLeft = "initial";
            this._mainContent.style.marginRight = "initial";
            document.body.style.backgroundSize = "auto";
         }
      }
   } // initApp

   scaleApp = () => {
      if (this._designMode === true) {
        return;
      }
      let targetHeight = this.settings.DesignHeight;
      let targetWidth = this.settings.DesignWidth;;
      let wow = window.outerWidth;
      let woh = window.outerHeight;
      let hFactor = 1.0;
      if (!this.isTouch()) {
        wow = window.innerWidth;
        woh = window.innerHeight;
      };
      hFactor = wow / targetWidth;
      if ((targetHeight * hFactor) > woh) {
         hFactor = woh / targetHeight;
      }
      if (hFactor > this.settings.MaxScaleFactor) {
         hFactor = this.settings.MaxScaleFactor;
      }
      if (hFactor < this.settings.MinScaleFactor) {
         hFactor = this.settings.MinScaleFactor;
      }
      this._scaleFactor = hFactor;
      if ((this.isMobile() && (!this.isSignage()))) {
        document.head.querySelector('meta[name="viewport"]').content = "width=device-width, initial-scale=" + this._scaleFactor + ", maximum-scale=" + this._scaleFactor + ", minimum-scale=" + this._scaleFactor + ", user-scalable=0, viewport-fit=cover"
      } else if (this.settings.EnableDesktopScaling === true) {
        document.body.style.zoom = this._scaleFactor;
      }
   }

   cleanLeftovers = () => {
      Array.from(document.querySelectorAll('.k-animation-container')).forEach((item) => {
        item.remove();
      });
      Array.from(document.querySelectorAll('.k-widget.k-window.k-dialog')).forEach((item) => {
        item.remove();
      });
      Array.from(document.querySelectorAll('.k-list-container.k-popup.k-group.k-reset')).forEach((item) => {
        item.remove();
      });
      Array.from(document.querySelectorAll('.k-popup')).forEach((item) => {
        item.remove();
      });
   }
   
   routeTo = async (newPath) => {
      if (this.isEmpty(newPath)) {
        return;
      }
      let path = newPath.toLowerCase();
      this._currentPage = path;
      localStorage.setItem(this._clientName+"-page", this._currentPage);
    
      if (path.indexOf(".html") < 0) {
        path += ".html";
      }
      const paths = window.location.pathname.split('/');
      let proj = paths[1];
      if (this.isEmpty(proj)) {
        proj = localStorage.getItem("project");
      }
      localStorage.setItem("activeproject", proj);
      const url = "/api/getpage?project=" + proj + "&page=" + path + "&client=" + this._clientName;
      const results = await this.getData(url);
  
      $(this._mainContent).fadeTo(500, 0, "linear", () => {
        $(this._mainContent).empty();
        this.cleanLeftovers();
        this._mainContent.insertAdjacentHTML("afterbegin", results);
        $(this._mainContent).fadeTo(500, 1, 'linear', () => {
        });
      });
   }
  
   openSocket = () => {
      try {
         //console.log("OpenSocket");
         clearTimeout(this._wsTimer);
         if (this._ws != null) {
            if ((this._ws.readyState === 0) || (this._ws.readyState === 1)) { // 0=connecting 1=open 2=closing 3=closed
               return
            }
         }
         let prefix = "ws";
         if (this.settings.EnableSSL === true) {
            prefix = "wss";
         }
         let host = location.host;
         if (!this.isEmpty(localStorage.getItem("serverip"))) {
            host = localStorage.getItem("serverip");
         }
         if (!this.isEmpty(this._clientName)) {
            this._ws = new window.WebSocket(prefix + '://' + host + '/' + this._clientName);
         } else {
            this._ws =new window.WebSocket(prefix + '://' + host);
         }
         this._ws.onopen = () => {
            //console.log("Websocket connected");
            clearTimeout(this._wsTimer);
            this._ws.send("setvariable|activescene_" + this._clientName + "~" + this._currentPage);
         };
         this._ws.onclose = () => {
            //console.log("Websocket closed");
			this._ws = null;
            this._wsTimer = setTimeout(() => {this.wsCheck();}, this.UPDATEFREQ);
         };
         this._ws.onerror = (e) => {
            //console.log("Websocket error", e);
            this._wsTimer = setTimeout(() => {this.wsCheck();}, this.UPDATEFREQ);
         };
         this._ws.onmessage = (evt) => {
            let c = evt.data.split("^");
            switch (c[0]) {
               case "_resolve": {
                  try {
                     $("#"+c[1])[0].resolve(JSON.parse(c[2]));
                  } catch (e) {
                     console.log(evt);
                     console.log(e, c[1], c[2]);
                  }
                  break;
               }
               case "ipaddr": {
                  this._localIP = c[1];
                  break;
               }
               case "webcmd": {
                  this.clientCmd(c[1]);
                  break;
               }
               default: {
                  if (!this.isEmpty(c[0])) {
                     this.setObjValue(c[0],c[1]);
                  }
               }
            }
         };
      } catch(e) {
         //console.log("OpenSocket error", e);
         this._wsTimer = setTimeout(() => {this.wsCheck();}, this.UPDATEFREQ);
      }
   }
   
   setObjValue = (id, value) => {
      try {
         const dx = value; //decodeURIComponent(value.replace(/%(?![0-9][0-9a-fA-F]+)/g, '%25'));
         Array.from(document.querySelectorAll('.' + id)).forEach((item) => {
            item.setValue(id, dx);
         });
         if (id.indexOf(".") > 0) {
            Array.from(document.getElementsByClassName(id)).forEach((item) => {
               item.setValue(id, dx);
            });
         }
      } catch (e) {
         console.log("setObjValue", id, value);
      }
   }

   wsCheck = () => {
      console.warn("WS State Check.", this._ws);
      clearTimeout(this._wsTimer);
      if (this._ws === null) {
         this.openSocket();
      } else if (this._ws.readyState === 3) {
         this.openSocket();
      } else {
         this._wstimer = setTimeout(() => {this.wsCheck();}, UPDATEFREQ);
      }
   }
  
   sendMessage = (id, msg) => {
      if (this._ws) {
        if (this._ws.readyState === 1) {
            this._ws.send("_resolve|" + id + "|" + JSON.stringify(msg));
            return true;
         }
      }
      return false;
   }
   
   send = (cmd) => {
      if (this._ws) {
        if (this._ws.readyState === 1) {
            this._ws.send(cmd);
            return true;
         }
      }
      return false;
   }

   popupViewer(url, title, left, top, width, height) {
      try {
         let params = 'toolbar=0,location=0,directories=0,status=0,menubar=0,scrollbars=0,resizable=1,copyhistory=0,width=' + width + ',height=' + height + ',top=' + top + ',left=' + left;
         let w = Number(width);
         let h = Number(height);
         this._windows[title] = window.open(url, title, params);
         this._windows[title].onload = (e) => {
            let deltaw = e.currentTarget.outerWidth - e.currentTarget.innerWidth;
            let deltah = e.currentTarget.outerHeight - e.currentTarget.innerHeight;
            let w1 = w + deltaw;
            let h1 = h + deltah;
            this._windows[title].resizeTo(w1,h1);
         }
      } catch {}
   }

   popupWindow(url, title, left, top, width, height) {
      if ((url.indexOf(".html") < 0) && (url.indexOf("/") < 0)) {
         url += ".html";
       }
      if (!this.isEmpty(this._windows[title])) {
         this._windows[title].close();
         this._windows[title] = null;
      };
      let params = 'toolbar=0,location=0,directories=0,status=0,menubar=0,scrollbars=0,resizable=1,copyhistory=0,width=' + width + ',height=' + height + ',top=' + top + ',left=' + left;
   	let w = Number(width);
	   let h = Number(height);
      this._windows[title] = window.open(url, title, params);
      this._windows[title].onload = (e) => {
         let deltaw = e.currentTarget.outerWidth - e.currentTarget.innerWidth;
         let deltah = e.currentTarget.outerHeight - e.currentTarget.innerHeight;
      	let w1 = w + deltaw;
      	let h1 = h + deltah;
         this._windows[title].resizeTo(w1,h1);
         let ov = '<ux-overlays overlays="1~' + title + '.html~~1"></ux-overlays>';
         this._windows[title].document.body.insertAdjacentHTML('beforeend', ov);
      }
   }

   setProfile = (server, project, client) => {
      console.log("setProfile: " + server + " " + project + " " + client);
      if (!this.isEmpty(server)) {
         localStorage.setItem("serverip", server);
      }
      if (!this.isEmpty(project)) {
         localStorage.setItem("project", project);
      }
      if (!this.isEmpty(client)) {
         localStorage.setItem("clientname", client.toLowerCase());
      }
   }

   clientCmd = async (cmd) => {
      if (this.isEmpty(cmd) || (this._designMode === true)) {
         return;
      }
      //console.log("clientCmd: " + cmd);
      if (cmd.indexOf('[[') >= 0) {
         let data = await this.getData("api/getvariable?vname=" + cmd);
         this.clientCmd(data);
         return;
      }
      let c = cmd.split('|');
      switch (c[0].toLowerCase()) { // 0       1                     2        3
         case "move": { // move|objectselector~left,top,width,height~newvalue~duration
            const parts = c[1].split('~');
            if (parts.length == 4) {
               parts[0] = parts[0].replaceAll('=','>');
               parts[1] = parts[1].toLowerCase();
               let f = document.querySelector(parts[0]);
               if (!this.isEmpty(f)) {
                  f.style.transition = parts[1] + " " + parts[3] + "s linear";
                  switch (parts[1]) {
                     case "top": {
                        f.style.top = parts[2] + "px";
                        break;
                     }
                     case "left": {
                        f.style.left = parts[2] + "px";
                        break;
                     }
                     case "width": {
                        f.style.width = parts[2] + "px";
                        break;
                     }
                     case "height": {
                        f.style.height = parts[2] + "px";
                        break;
                     }
                  }
               }
            }
            break;
         }
         case "resetdefault": {
            if (!this.isEmpty(srApp)) {
               srApp.resetDefault();
            }
            break;
         }
         case "setlaunchproperties": { // SetLaunchProperties|project|serverip|clientname
            if (c.length === 4) { 
               localStorage.setItem("project", c[1]);
               localStorage.setItem("serverip", c[2]);
               localStorage.setItem("clientname", c[3]);
            }
            break;
         }
         case "setupwifi": {
            if (!this.isEmpty(srApp)) {
               await srApp.setupWifi();
            }
            break;
         }
         case "exitapp": {
            if (!this.isEmpty(srApp)) {
               srApp.exitApp();
            }
            break;
         }
         case "sendir": {
            if (!this.isEmpty(srApp)) {
               this._ws.send("setvariable|iractive_" + this._clientName + "~1");
               srApp.sendIr(c[1]);
               setTimeout(() => {
                  this._ws.send("setvariable|iractive_" + this._clientName + "~0");
               }, 500);
            }
            break;
         }
         case "getlaunchproperties": {
            let props = "Macro|";
            this._project = localStorage.getItem("project");
            this._serverIp = localStorage.getItem("serverip");
            props += "SetVariable|current_project_" + this._clientName + "~" + this._project + "!";
            props += "SetVariable|current_clientname_" + this._clientName + "~" + this._clientName + "!";
            props += "SetVariable|current_serverip_" + this._clientName + "~" + this._serverIp;
            this.send(props);
            break;
         }
         case "writesetting": {
            if (c.length === 3) {
               this.writeSetting(c[1], c[2]);
            }
         }
         case "restart": {
            if (!this.isEmpty(srApp)) {
               window.location.href = "http://localhost";
            }
            break;
         }
         case "setprofile": {
            const p=c[1].split('~');
            console.log(p);
            if (p.length === 3) {
               this.setProfile(p[0], p[1], p[2]);
            }
            break;
         }
         case "popup": { // popup|url|title|left|top|width|height
            const p=c[1].split('~');
            if (p.length === 6) {
               this.popupWindow(p[0], p[1], p[2], p[3], p[4], p[5]);
            }
            break;
         }
         case "popupviewer": { // popup|url|title|left|top|width|height
            const p=c[1].split('~');
            if (p.length === 6) {
               this.popupViewer(p[0], p[1], p[2], p[3], p[4], p[5]);
            }
            break;
         }
         case "togglewindow": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.toggleWindow();
            }
            break;
         }
         case "togglegroup": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.toggleGroup();
            }
            break;
         }
         case "collapsegroup": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.collapseGroup();
            }
            break;
         }
         case "expandgroup": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.expandGroup();
            }
            break;
         }
         case "hideplayer": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.hide();
            }
            break;
         }
         case "rebuild": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.rebuild();
            }
            break;
         }
         case "showplayer": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.show();
            }
            break;
         }
         case "stop": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.stop();
            }
            break;
         }
         case "start": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.start();
            }
            break;
         }
         case "pause": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.pause();
            }
            break;
         }
         case "play": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.play();
            }
            break;
         }
         case "playpause": {
            const obj = document.querySelector("#"+c[1]);
            if (!this.isEmpty(obj)) {
               obj.playpause();
            }
            break;
         }
         case "volume": {
            const p=c[1].split('~');
            const obj = document.querySelector("#"+p[0]);
            if (!this.isEmpty(obj)) {
               switch (p[1].toLowerCase()) {
                  case "up": {
                     obj.volume("up");
                     break;
                  }
                  case "down": {
                     obj.volume("down");
                     break;
                  }
                  default: {
                     obj.volume(p[1]);
                     break;
                  }
               }
            }
            break;
         }
         case "mute": {
            const p=c[1].split('~');
            const obj = document.querySelector("#"+p[0]);
            if (!this.isEmpty(obj)) {
               switch (p[1].toLowerCase()) {
                  case "on": {
                     obj.mute("on");
                     break;
                  }
                  case "off": {
                     obj.mute("off");
                     break;
                  }
                  case "toggle": {
                     obj.mute("toggle");
                     break;
                  }
               }
            }
            break;
         }
         case "keepalive": {
            break;
         }
         case "cancelkeepalive": {
            break;
         }
         case 'home': {
            this._appHistory = [];
            this.doCommand("setvariable|backenabled_"+ this._clientName, "0");
            this.routeTo('index');
            break;
         }
         case 'back': {
            if (this._appHistory.length > 0) {
               this._appHistory.pop();
               if (this._appHistory.length > 0) {
                  let path = this._appHistory[this._appHistory.length-1];
                  this.doCommand("setvariable|backenabled_"+ this._clientName + "~1");
                  this.routeTo(path);
               } else {
                  this.doCommand("setvariable|backenabled_"+ this._clientName + "~0");
                  this.routeTo('index');
               }
            }
            break;
         }
         case "loadscene": {
            if (!this.isEmpty(c[1])) {
               if (this._lastPage != c[1]) {
                  this._appHistory.push(c[1]);
                  this.doCommand("setvariable|backenabled_"+ this._clientName + "~1");
               }
               this.routeTo(c[1]);
            }
            break;
         }
         case "lastproject": {
            let p = localStorage.getItem("returnproject");
            if (!this.isEmpty(p)) {
               if (p.indexOf("/") === 0) {
                  p = p.substring(1);
               }
               window.location.href = window.location.origin + "/" + p;
            }
            break;
         }
         case "loadproject": {
            if (!this.isEmpty(c[1])) {
               let p = localStorage.getItem("activeproject");
               localStorage.setItem("returnproject", p);
               if (c[1].indexOf("/") === 0) {
                  c[1] = c[1].substring(1);
               }
               window.location.href = window.location.origin + "/" + c[1];
            }
            break;
         }										//                   0   1    2  3        4
         case "loadtemplate": {
            if (!this.isEmpty(c[1])) {
               let p = localStorage.getItem("activeproject");
               localStorage.setItem("returnproject", p);
               if (c[1].indexOf("/") === 0) {
                  c[1] = c[1].substring(1);
               }
               window.location.href = window.location.origin + "/" + c[1];
            }
            break;
         }										//                   0   1    2  3        4
         case 'toggle': {
            let o = document.querySelector("#"+c[1]);
            if (!this.isEmpty(o)) {
               if (o.classList.contains("hidden")) {
                  o.classList.remove("hidden");
                  this.doCommand("SetVariable|" + c[1] + "-visible-" + this._clientName + "~true");
               } else {
                  o.classList.add("hidden");
                  this.doCommand("SetVariable|" + c[1] + "-visible-" + this.clientName + "~false");
               }
            }
            break;
         }
         case 'show': {
            let o = document.querySelector("#"+c[1]);
            if (!this.isEmpty(o)) {
               if (o.classList.contains("hidden")) {
                  o.classList.remove("hidden");
                  this.doCommand("SetVariable|" + c[1] + "-visible-" + this._clientName + "~true");
               }
            }
            break;
         }
         case 'pageswiper': {
            const p=c[1].split('~');
            const obj = document.querySelector("#"+p[0]);
            if (!this.isEmpty(obj)) {
               let scrollview = $("#"+p[0]).data("kendoScrollView");
               switch (p[1].toLowerCase()) {
                  case "prev": {
                     scrollview.prev();
                     break;
                  }
                  case "next": {
                     scrollview.prev();
                     break;
                  }
                  default: {
                     scrollview.scrollTo(parseInt(p[1]));
                     break;
                  }
               }
            }
            break;
         }
         case 'hide': {
            let o = document.querySelector("#"+c[1]);
            if (!this.isEmpty(o)) {
               if (!o.classList.contains("hidden")) {
                  o.classList.add("hidden");
                  this.doCommand("SetVariable|" + c[1] + "-visible-" + this._clientName + "~false");
               }
            }
            break;
         }
         case 'refreshpage': {
            this.routeTo(this._currentPage);
            break;
         }
         case 'showdimensions': {
            alert("Height = " + window.innerHeight + "px Width = " + window.innerWidth + "px");
            break;
         }
         case 'refreshgrids': {
            this.refreshGrids();
            break;
         }
         case 'echo': {
            console.log(cmd);
            break;
         }
         case 'macro': {
            const macs=cmd.substring(6).replaceAll('##','!').split('!');
            for (let i=0; i<macs.length; i++) {
               this.clientCmd(macs[i]);
            }
            break;
         }
         case 'setclientname': {
            this.clientName(c[1]);
            this.refreshPage();
            break;
         }
         case 'deleteclientname': {
            if (!this.isEmpty(this._localIP)) {
               localStorage.setItem('clientname', 'w' + sReplace(this._localIP,".",""));
               window.location.href=HOMEPAGE;
            } else {
               localStorage.removeItem('clientname');
               window.location.href=HOMEPAGE;
            }
            break;
         }
         case "toast": { 
            const p=c[1].split("~");
            this.doToast(p[0],p[1],p[2],p[3]);
            break;
         }
         case "saveform": { // saveform|id~apiurl
            const p=c[1].split("~");
            this.saveForm(p[0],p[1]);
            break;
         }
         case "launch": {
            window.open(c[1], "_blank");
            break;
         }
         case "printpage": {
            window.print();
            break;
         }
         case "longpress": {
            this._longpress = !this._longpress;
            this.doCommand("SetVariable|longpress_" + this._clientName + "~" + this._longpress);
            break;
         }
         case "numlock": {
            this._numlock = !this._numlock;
            this.doCommand("SetVariable|numlock_" + this._clientName + "~" + this._numlock);
            if (!this.isEmpty(this.smartRemote)) {
               this.smartRemote._numlock = this._numlock;
            }
            break;
         }
         case "remotebutton": {
            switch (c[1].toLowerCase()) {
               case "ok": {
                  this.smartRemote.sendButton("ok",this._longpress);
                  break;
               }
               case "back": {
                  this.smartRemote.sendButton("back",this._longpress);
                  break;
               }
               case "power": {
                  this.smartRemote.sendButton("power",this._longpress);
                  break;
               }
               case "menu": {
                  this.smartRemote.sendButton("menu",this._longpress);
                  break;
               }
               case "more": {
                  this.smartRemote.sendButton("more",this._longpress);
                  break;
               }
               case "home": {
                  this.smartRemote.sendButton("home",this._longpress);
                  break;
               }
               case "mute": {
                  this.smartRemote.sendButton("mute",this._longpress);
                  break;
               }
               case "volumeup": {
                  this.smartRemote.sendButton("volumeup",this._longpress);
                  break;
               }
               case "volumedown": {
                  this.smartRemote.sendButton("volumedown",this._longpress);
                  break;
               }
               case "up": {
                  this.smartRemote.sendButton("up",this._longpress);
                  break;
               }
               case "down": {
                  this.smartRemote.sendButton("down",this._longpress);
                  break;
               }
               case "left": {
                  this.smartRemote.sendButton("left",this._longpress);
                  break;
               }
               case "right": {
                  this.smartRemote.sendButton("right",this._longpress);
                  break;
               }
               case "pageup": {
                  this.smartRemote.sendButton("pageup",this._longpress);
                  break;
               }
               case "pagedown": {
                  this.smartRemote.sendButton("pagedown",this._longpress);
                  break;
               }
               case "rewind": {
                  this.smartRemote.sendButton("rewind",this._longpress);
                  break;
               }
               case "playpause": {
                  this.smartRemote.sendButton("playpause",this._longpress);
                  break;
               }
               case "fastforward": {
                  this.smartRemote.sendButton("fastforward",this._longpress);
                  break;
               }
               case "stop": {
                  this.smartRemote.sendButton("stop",this._longpress);
                  break;
               }
               case "f1": {
                  this.smartRemote.sendButton("f1",this._longpress);
                  break;
               }
               case "f2": {
                  this.smartRemote.sendButton("f2",this._longpress);
                  break;
               }
               case "f3": {
                  this.smartRemote.sendButton("f3",this._longpress);
                  break;
               }
            }
            break;
         }
         case "reload": {
            window.location.reload(true);
         }
      }
   }
   
   refreshGrids = () => {
      const grids = document.querySelectorAll(".k-pager-refresh");
      grids.forEach(item => {
         item.click();
      });
   }
   
   restart = () => {
      this.doCommand("restart");
   }
    
   shutdown = () => {
      this.doCommand("shutdown");
   }
    
   reboot = () => {
      this.doCommand("reboot");
   }
   
   doCommand = async (cmd) => {
      if (this.isEmpty(cmd) || (this._designMode === true)) {
        return;
      }
      //console.log("doCommand: " + cmd);
      if (this._ws !== null) {
        if (this._ws.readyState === 1) {
          this._ws.send(cmd);
          return;
        }
      }
      cmd = encodeURIComponent(cmd);
      let r = await this.getData("/api/doCommand",{command:cmd, client: this._clientName });
   }
     
   doToast = (tType, header, message, showTime) => {
      if (showTime == 0) {
        showTime = false;
      }
      switch (tType.toLowerCase()) {
         case "success": {
            $.toast({text: message, heading: header, icon: "success", hideAfter: showTime});
            break;
         }
         case "warning": {
            $.toast({text: message, heading: header, icon: "warning", hideAfter: showTime});
            break;
         }
         case "error": {
            $.toast({text: message, heading: header, icon: "error", hideAfter: showTime});
            break;
         }
         case "info": {
            $.toast({text: message, heading: header, icon: "info", hideAfter: showTime});
            break;
         }
         case "mic": {
            $.toast({text: message, heading: header, icon: "mic", hideAfter: showTime});
            break;
         }
         case "speaker": {
            $.toast({text: message, heading: header, icon: "speaker", hideAfter: showTime});
            break;
         }
         case "phone": {
            $.toast({text: message, heading: header, icon: "phone", hideAfter: showTime});
            break;
         }
         default: {
            $.toast({text: message, heading: header, hideAfter: showTime});
            break;
         }
      }
   }
  
   twoDigitPad = (num) => {
      return num < 10 ? "0" + num : num;
   }
  
   formatDate = (date, patternStr) => {
      const monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
      const dayOfWeekNames = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];
      if (!patternStr) {
        patternStr = 'M/d/yyyy';
      }
      let day = date.getDate(),
          month = date.getMonth(),
          year = date.getFullYear(),
          hour = date.getHours(),
          minute = date.getMinutes(),
          second = date.getSeconds(),
          milliseconds = date.getMilliseconds(),
          hundredths = milliseconds / 10,
          tenths = hundredths / 10,
          h = hour % 12,
          hh = this.twoDigitPad(h),
          HH = this.twoDigitPad(hour),
          mm = this.twoDigitPad(minute),
          ss = this.twoDigitPad(second),
          tt = hour < 12 ? 'AM' : 'PM',
          EEEE = dayOfWeekNames[date.getDay()],
          EEE = EEEE.substring(0, 3),
          dd = this.twoDigitPad(day),
          M = month + 1,
          MM = this.twoDigitPad(M),
          MMMM = monthNames[month],
          MMM = MMMM.substring(0, 3),
          yyyy = year + "",
          yy = yyyy.substring(2, 2)
       ;
       patternStr = patternStr.replace('dddd', EEEE);
       patternStr = patternStr.replace('ddd', EEE);
       patternStr = patternStr.replace('dd', dd);
       patternStr = patternStr.replace('d', day);
       patternStr = patternStr.replace('MMMM', MMMM);
       patternStr = patternStr.replace('MMM', MMM);
       patternStr = patternStr.replace('MM', MM);
       patternStr = patternStr.replace('M', M);
       patternStr = patternStr.replace('yyyy', yyyy);
       patternStr = patternStr.replace('yy', yy);
       patternStr = patternStr.replace('HH', HH);
       patternStr = patternStr.replace('H', hour);
       patternStr = patternStr.replace('hh', hh);
       patternStr = patternStr.replace('h', h);
       patternStr = patternStr.replace('mm', mm);
       patternStr = patternStr.replace('m', minute);
       patternStr = patternStr.replace('ss', ss);
       patternStr = patternStr.replace('s', second);
       patternStr = patternStr.replace('fff', milliseconds);
       patternStr = patternStr.replace('ff', hundredths);
       patternStr = patternStr.replace('f', tenths);
       patternStr = patternStr.replace('tt', tt);
       return patternStr;
   }
  
   tune = (chan, callsign) => {
      this.doCommand("tune|" + chan + "~" + callsign);
   }  
    
   schedule = (chan, callsign, title, localdate, localtime) => {
      this.doCommand("schedule|" + chan + "~" + callsign + "~" + title + "~" + localdate + "~" + localtime);
   }
  
   togglefavorite = (item, chan, lineup) => {
      if (item.classList.contains("text-pink-500") === true) {
         item.classList.remove("text-pink-500");
         item.classList.add("text-bluegrey-900");
         this.doCommand("myTV|RemoveFavorite~" + lineup + "~" + chan);
      } else {
         item.classList.remove("text-bluegrey-900");
         item.classList.add("text-pink-500");
         this.doCommand("myTV|AddFavorite~" + lineup + "~" + chan);
      }
   }
  
   RGBAtoHSLA = (rgba) => {
      let tmp = rgba.toLowerCase().replace("rgba(","").replace("rgb(","").replace(")","").replace(" ","");
      let parts = tmp.split(',');
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 1;
      switch (parts.length) {
        case 3:
          r = parseFloat(parts[0]) / 255;
          g = parseFloat(parts[1]) / 255;
          b = parseFloat(parts[2]) / 255;
          break;
        case 4:
          r = parseFloat(parts[0]) / 255;
          g = parseFloat(parts[1]) / 255;
          b = parseFloat(parts[2]) / 255;
          a = parseFloat(parts[3]);
          break;
      }
      let cmin = Math.min(r,g,b);
      let cmax = Math.max(r,g,b);
      let delta = cmax - cmin;
      let h = 0;
      let s = 0;
      let l = 0;
      if (delta == 0)
        h = 0;
      else if (cmax == r)
        h = ((g - b) / delta) % 6;
      else if (cmax == g)
        h = (b - r) / delta + 2;
      else
        h = (r - g) / delta + 4;
      h = Math.round(h * 60);
      if (h < 0)
        h += 360;
      l = (cmax + cmin) / 2;
      s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
      s = +(s * 100).toFixed(1);
      l = +(l * 100).toFixed(1);
      return [h,s,l,a];
   }
    
   addNewComboItem = (id, name) => {
      let widget = $("#" + id).getKendoComboBox();
      let dataSource = widget.dataSource;
      dataSource.add({
         name: name,
         value: "0"
      });
      dataSource.one("sync", function() {
         widget.select(dataSource.view().length - 1);
      });
      dataSource.sync();
      widget.value("");
      widget.select(-1);
   }
   
   setButtonVisibility = () => {
      let macro = "BackgroundMacro|";
      this.pageButtons.forEach(item => {
         macro += "SetVariable|smartremote_" + item.name + "_enabled_" + this._clientName + "~";
         if (!fxApp.isEmpty(item.longpress) || !fxApp.isEmpty(item.shortpress)) {
          macro += "1!";
        } else {
         macro += "0!";
        }
      });
      macro += "//fini";
      clearTimeout(this._sbvTimer);
      this._sbvTimer = setTimeout(() => {
         this.send(macro);
      }, 1000);
   }
}
  
const fxApp = new AppCore();
fxApp.restoreGlobals();

document.addEventListener('readystatechange', checkForReady);
function checkForReady() {
   if (document.readyState === "complete") {
      fxApp.initApp();
      document.removeEventListener('readystatechange', this.checkForReady);
   }
}

  
  
  