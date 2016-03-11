/*
 * 	Copyright (C) 2012-2016 DFKI GmbH
 * 	Deutsches Forschungszentrum fuer Kuenstliche Intelligenz
 * 	German Research Center for Artificial Intelligence
 * 	http://www.dfki.de
 * 
 * 	Permission is hereby granted, free of charge, to any person obtaining a 
 * 	copy of this software and associated documentation files (the 
 * 	"Software"), to deal in the Software without restriction, including 
 * 	without limitation the rights to use, copy, modify, merge, publish, 
 * 	distribute, sublicense, and/or sell copies of the Software, and to 
 * 	permit persons to whom the Software is furnished to do so, subject to 
 * 	the following conditions:
 * 
 * 	The above copyright notice and this permission notice shall be included 
 * 	in all copies or substantial portions of the Software.
 * 
 * 	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
 * 	OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
 * 	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
 * 	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
 * 	CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, 
 * 	TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
 * 	SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Media Module: Implementation for Speech Recognition via AT&T ASR over HTTPS/POST
 * 
 * @requires AMR encoder (workers/amrEncoder.js)
 * @requires Cross-Domain access
 * @requires CSP for accessing the AT&T ASR server, e.g. "connect-src https://api.att.com" or "default-src https://api.att.com"
 * 
 */
newWebAudioAsrImpl = (function ATnTWebAudioInputImpl(){
		
	/**  @memberOf ATnTWebAudioInputImpl# */
	var MODE = 'atnt';

	/**  @memberOf ATnTWebAudioInputImpl# */
	var _pluginName = 'atntWebAudioInput';

	/** 
	 * @type mmir.LanguageManager
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var languageManager = require('languageManager');
	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var configurationManager = require('configurationManager');

	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var mediaManager = require('mediaManager');
	
	/**
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var oAuthToken = '';
	
	
	/**
	 * Supported language/country codes:
	 * since the services currently has very limited country support,
	 * this is used for mapping unsupported country codes to supported ones
	 * 
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var supportedLang = {
		'en': 'en-US',
		'es': 'es-US'
	};

	/**
	 * The default language of the AT&T recognition service (i.e. used by service, if language param is omitted)
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var defaultLang = supportedLang.en;
	
	/**
	 * HELPER retrieve language setting and apply impl. specific corrections/adjustments
	 * (i.e. deal with AT&T specific quirks for language/country codes)
	 *   
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var getFixedLang = function(options){
		
		var lang = options && options.language? options.language : languageManager.getLanguageConfig(_pluginName);
		
		//since the service supportes few languages/country codes, try to automatically "convert"
		// mismatched country-codes to supported ones
		if(/^e[ns]/i.test(lang)){
			
			var isSupported = false;
			for(var l in supportedLang){
				if(supportedLang.hasOwnProperty(l) && supportedLang[l] === lang){
					isSupported = true;
					break;
				}
			}
			
			if(! isSupported){
				var langCode = lang.substring(0, 2);
				console.warn('unsupported language/country code "'+lang+'": reverting to supported code '+supportedLang[langCode]);
				lang = supportedLang[langCode];
			}
			
		}
		
		return lang;
	};
	
//	var textProcessor, currentFailureCallback;
	
	/**
	 * @returns {Boolean} TRUE if cause was invalid authentification (-> might try to get a new oauth token).
	 * 					Otherwise FALSE
	 * 
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var asrErrorWrapper = function(ajax,response,blobsize){

		var status = (ajax.status).toString(), msg;

		var text = ajax.responseText;

		var isInvalidAuth = false;
		//for stauts 400, 401, 403 AND "MessageId": "POL0001"
		// -> invalid auth token
		if(/POL0001/.test(text)){
			isInvalidAuth = true;
		}

		var isInvalid = false;
		//for stauts 400 AND "MessageId": "SVC0001"
		// -> custom error
		if(/SVC0001/.test(text)){
			isInvalid = true;
		}

		var isInvalidInput = false;
		//for stauts 400 AND "MessageId": "SVC0002"
		// -> invalid input
		if(/SVC0002/.test(text)){
			isInvalidInput = true;
		}

		var msg;
		switch (status) {
		//4xx Client Error
		case '400':
			if(isInvalidInput || isInvalid){
				msg = isInvalidInput? 'Invalid input value for message part: ' : '';
				break;
			}
		case '401':
		case '403':
			if(isInvalidAuth){
				msg = 'A policy error occurred.';
			} else {
				msg = '';
			}
			break;
			// 5xx Server Error
		case '502':
			msg = 'The API Gateway could not respond to the request.';
			break;
		default:
			msg = 'UNKNOWN ERROR';
		break;
		}

		console.error('Error response from server (status '+status+'): '+msg+' -> response: '+text);

		return isInvalidAuth;
	};

	/**
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var doSend = function(msg, successCallback, errorCallback){

//		successCallback = successCallback || textProcessor;
//		errorCallback = errorCallback || currentFailureCallback;
		
		if(!oAuthToken){
			//missing oauth-token 	-> try to retrieve one now, and continue with asr when token is available
			doInitSend(function(){
				//after init/retrieving the oauth token has finished: re-submit the failed request:
				doSend(msg, successCallback, errorCallback);
			});
			return; //////////////////////////////// EARLY EXIT ///////////////////////////////
		}

		var ajaxSuccess = function() {

			if(oAjaxReq.status == 200){

//				console.log("AJAXSubmit - Success!");
//				console.log("ResonseText in input");

				var respText = false;

				var jsonResp = JSON.parse(this.responseText);
				if(jsonResp && jsonResp.Recognition && !! jsonResp.Recognition.NBest){
					respText = jsonResp.Recognition.NBest[0].ResultText;
				} else {
					console.error('no asr results!');
				}

				if(successCallback && respText){
					successCallback(respText,1);
				}

			} else {

				if( asrErrorWrapper(oAjaxReq, this, dataSize) ){
					//error was due to invalid authentification (oauth token may have expired)
					// -> try to renew the oauth token

					doInitSend(function(){
						//after init has finished: re-submit the failed request:
						doSend(msg, successCallback, errorCallback);
					});

				}
				//else: TODO invoke error-callback for some of the error-codes (?)
			}


		};


		var data = msg.buf;
		var dataSize = data.size;
//		var sample_rate = 44100; //PB Fix nicht-hardcoden
//		console.log("Ajax-Data: ");
//		console.log(data);

		var oAjaxReq = new XMLHttpRequest();

		var apiLang = getFixedLang();//TODO use options parameter from startRecord-/recognize-invocation

		//oAjaxReq.submittedData = oData;
//		oAuthToken =  "BF-ACSI~4~20150218153931~c9fdO6D2sLzftjyleO1KeWdE4aDf1kgu";
		//oAjaxReq.open("POST", "http://localhost:8080", true);
		var url = "https://api.att.com/speech/v3/speechToText";//"https://api.att.com/speech/v3/speechToTextCustom";
		oAjaxReq.open("POST", url , true);


		oAjaxReq.setRequestHeader("Authorization", "Bearer "+oAuthToken);
		oAjaxReq.setRequestHeader("Accept", "application/json");
		oAjaxReq.setRequestHeader("Content-Type", "audio/amr");
		//oAjaxReq.setRequestHeader("Transfer-Encoding", "chunked"); //chrome does not allow :/

		//valid values for speechToText API:
		// en-US (DEFAULT), es-US
		//NOTE: this is only evaluated, if X-SpeechContext is set to Generic (DEFAULT)

		//WARNING: if apiLang is other than valid values, the server responds with an error!
		if(! /en-US|es-US/.test(apiLang)){
			console.warn('Unsupported language "'+apiLang+'" requested ... ');
//			apiLang = defLang;
		}
		
		if(apiLang !== defaultLang){
			oAjaxReq.setRequestHeader("Content-Language", apiLang);
//			oAjaxReq.setRequestHeader("X-SpeechContext", "Generic");// <- if omitted, the default is: Generic
//			oAjaxReq.setRequestHeader("Content-Disposition", 'form-data;name="x-voice"');// <- for speechToTextCustom API
		}

		oAjaxReq.onload = ajaxSuccess;

		oAjaxReq.send(data);
	};

	/**
	 * init ASR atnt: get oAuth token
	 * 
	 * @memberOf ATnTWebAudioInputImpl#
	 */
	var doInitSend = function _initSendAtnt(oninit){

		//Get from <https://matrix.bf.sl.attcompute.com/>
		var appKey = configurationManager.get([_pluginName, 'appKey']);
		var appSecret = configurationManager.get([_pluginName, 'appSecret']);

		var oReq = new XMLHttpRequest();
		var url = "https://api.att.com/oauth/v4/token";
		oReq.open("POST", url, true);
		oReq.setRequestHeader("Accept", "application/json");
		oReq.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		oReq.onload = function(oEvent) {
			if (oReq.status === 200) {
				jsonResp = JSON.parse(oReq.responseText);
				oAuthToken = jsonResp.access_token;
				console.log("Got oAuth acces-token: " + jsonResp.access_token);

				if(oninit){
					console.log("invoking on-init callback for ajax");
					oninit();
				}

			} else {
				console.error( "Error for oAuth req to "+url+ " (status" + oReq.status + "): "+oReq.responseText);

				//TODO invoke error-callback
			}
		};

		var keystring = "client_id="+appKey+"&client_secret="+appSecret+"&grant_type=client_credentials&scope=SPEECH";
		oReq.send(keystring);

		//ajax end
	};

	/** @memberOf ATnTWebAudioInputImpl# */
	var onSilenceDetected = function(evt){

		var recorder = evt.recorder;

		//encode all buffered audio now
		recorder.doEncode();
		recorder.doFinish();

		//FIXME experimental callback/listener for on-detect-sentence -> API may change!
		var onDetectSentenceListeners = mediaManager.getListeners('ondetectsentence');
		for(var i=0, size = onDetectSentenceListeners.length; i < size; ++i){
			onDetectSentenceListeners[i]();//blob, inputId);
		}

		return false;
	};

	/** @memberOf ATnTWebAudioInputImpl# */
	var onClear = function(evt){

		evt.recorder && evt.recorder.clear();
		return false;
	};

	/** @memberOf ATnTWebAudioInputImpl# */
	var doStopPropagation = function(){
		return false;
	};

	/**  @memberOf ATnTWebAudioInputImpl# */
	return {
		/** @memberOf ATnTWebAudioInputImpl.AudioProcessor# */
		_init: doInitSend,
//		initRec: function(){},
		sendData: doSend,
		oninit: doStopPropagation,
		onstarted: doStopPropagation,
		onaudiostarted: doStopPropagation,
		onstopped: doStopPropagation,
		onsendpart: doStopPropagation,
		onsilencedetected: onSilenceDetected,
		onclear: onClear,
		getPluginName: function(){
			return _pluginName;
		},
		setCallbacks: function(successCallback, failureCallback){}//NOOP these need to be set in doSend() only
//
//			textProcessor = successCallback;
//			currentFailureCallback = failureCallback;
//		}
	};
		
})();