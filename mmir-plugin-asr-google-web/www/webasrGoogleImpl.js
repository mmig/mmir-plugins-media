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
 * Media Module: Implementation for Speech Recognition via the Google Web Speech Recognition service v2 via HTTPS/POST
 * 
 * @requires FLAC encoder (workers/flacEncoder.js)
 * @requires Cross-Domain access
 * @requires CSP for accessing the Google speech-api server, e.g. "connect-src https://www.google.com" or "default-src connect-src https://www.google.com"
 * 
 */
newWebAudioAsrImpl = (function GoogleWebAudioInputImpl(){

	/**  @memberOf GoogleWebAudioInputImpl# */
	var MODE = 'google';
	
	/**  @memberOf GoogleWebAudioInputImpl# */
	var _pluginName = 'googleWebAudioInput';

	/** 
	 * legacy mode: use pre-v4 API of mmir-lib
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var _isLegacyMode = true;
	/** 
	 * Reference to the mmir-lib core (only available in non-legacy mode)
	 * @type mmir
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var _mmir = null;
	
	//get mmir-lib core from global namespace:
	_mmir = window[typeof MMIR_CORE_NAME === 'string'? MMIR_CORE_NAME : 'mmir'];
	if(_mmir){
		// set legacy-mode if version is < v4
		_isLegacyMode = _mmir? _mmir.isVersion(4, '<') : true;
	}
	
	/**
	 * HELPER for require(): 
	 * 		use module IDs (and require instance) depending on legacy mode
	 * 
	 * @param {String} id
	 * 			the require() module ID
	 * 
	 * @returns {any} the require()'ed module
	 * 
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var _req = function(id){
		var name = (_isLegacyMode? '' : 'mmirf/') + id;
		return _mmir? _mmir.require(name) : require(name);
	};
	
	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var mediaManager = _req('mediaManager');

	/** 
	 * @type mmir.LanguageManager
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var languageManager = _req('languageManager');
	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var configurationManager = _req('configurationManager');
	
	/** @memberOf GoogleWebAudioInputImpl# */
	var result_types = {
			"FINAL": 				"FINAL",
			"INTERIM": 				"INTERIM",
			"INTERMEDIATE":			"INTERMEDIATE",
			"RECOGNITION_ERROR": 	"RECOGNITION_ERROR",
			"RECORDING_BEGIN": 		"RECORDING_BEGIN",
			"RECORDING_DONE": 		"RECORDING_DONE"
	};

	/** @memberOf GoogleWebAudioInputImpl# */
	var lastBlob = false;
	/**
	 * HELPER retrieve language setting and apply impl. specific corrections/adjustments
	 * (i.e. deal with Nuance specific quirks for language/country codes)
	 *   
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var getFixedLang = function(options){
		
		var lang = options && options.language? options.language : languageManager.getLanguageConfig(_pluginName, 'long');

		return languageManager.fixLang('google', lang);
	};

	/**
	 * Recognition options for current recognition process.
	 * 
	 * @memberOf GoogleWebAudioInputImpl#
	 * @see mmir.MediaManager#recognize
	 */
	var currentOptions;
	
	/** 
	 * @returns {Error} an error description, that is a PlainObject with properties
	 * 					message: STRING
	 * 					status: NUMBER
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var asrErrorWrapper = function(ajax,response,blobsize){

		var status = (ajax.status).toString(), msg;

		switch (status) {
		
		//TODO procecess specific errors
		//2xx "Success"
		//4xx Client Error
		//5xx Server Error
		
		default:
			msg = 'Error ' + status + ': ' + this.responseText;
		break;
		}

		console.error('Error response from server (status '+status+'): '+msg);

		return {
			status: status,
			message: msg
		};
	};

	/** @memberOf GoogleWebAudioInputImpl# */
	var doSend = function(msg, successCallback, errorCallback){


		function ajaxSuccess () {

			if (oAjaxReq.status == 200) {

				//result format example for JSON:
				//
				//{"result":[]}
				//{"result":[{"alternative":[{"transcript":"this is a test","confidence":0.95095706},{"transcript":"this is the test"},{"transcript":"this is the best"},{"transcript":"this is a text"},{"transcript":"this is the tests"}],"final":true}],"result_index":0}
				//
				var respText = this.responseText;

				//QUICK-FIX: several results may get sent within one response, separated by a NEWLINE
				var list = respText.split(/\r?\n/gm);
				
				var result = '', score, alt, data, text, num;
				var type = lastBlob? result_types.FINAL : result_types.INTERMEDIATE;
				for(var i=0,size=list.length; i < size; ++i){
					
					if(!list[i]){
						continue;
					}
					
					try{
						
						//format:
						//	{
						//		"result" : [{
						//				"alternative" : [{
						//						"transcript" : "this is a test",
						//						"confidence" : 0.95095706
						//					}, {
						//						"transcript" : "this is the test"
						//					}, {
						//						"transcript" : "this is the best"
						//					}, {
						//						"transcript" : "this is a text"
						//					}, {
						//						"transcript" : "this is the tests"
						//					}
						//				],
						//				"final" : true
						//			}
						//		],
						//		"result_index" : 0
						//	}
						data = JSON.parse(list[i]);
						if(typeof data.result_index === 'undefined'){
							continue;
						}
						
						data = data.result[data.result_index];
//						type = data['final'] === true? 'FINAL' : 'INTERMEDIATE'; TODO
						
						data = data.alternative;
						
						for(var j=0,len=data.length; j < len; ++j){
							
							if(!data[j] || !data[j].transcript){
								continue;
							}

							text = data[j].transcript;
							num = data[j].confidence;
							
							if(!result){
								result = text;
								score = num;
							} else {
								
								if(!alt){
									alt = [];
								}
								
								alt.push({text: text, score: num});
							}
						}
						
					} catch(err){
						console.error('Error processing ASR result at '+i+' -> "'+list[i]+'": ' + err, err);
					}
				}

				//[asr_result, asr_score, asr_type, asr_alternatives, asr_unstable]
				//[ text, number, STRING (enum/CONST), Array<(text, number)>, text ]
				//                ["FINAL" | "INTERIM"...]
				if(successCallback){
					successCallback(result, score, type, alt);
				}

			} else {
				var err = asrErrorWrapper(oAjaxReq, this, dataSize);
				errorCallback && errorCallback(err.message, err.status);
				//TODO invoke error-callback for some of the error-codes (?)
			}
		}

		var data = msg.buf;//is a Blob
		var dataSize = data.size;
		var sample_rate = currentOptions.sampleRate? currentOptions.sampleRate : 44100;
		
//		console.log("Ajax-Data: ", data);

		var oAjaxReq = new XMLHttpRequest();

		var apiLang = getFixedLang(currentOptions);

		var key = currentOptions.appKey? currentOptions.appKey : configurationManager.getString( [_pluginName, "appKey"] );
		var baseUrl = "https://www.google.com/speech-api/v2/recognize?client=chromium&output=json";
		
		var url = baseUrl + '&key=' + key + '&lang=' + apiLang;
		
		var alternatives = typeof currentOptions.results === 'number'? currentOptions.results : 1;
		if(typeof alternatives !== 'undefined'){
			url += '&maxAlternatives='+alternatives;
		}

		var oAjaxReq = new XMLHttpRequest();

		oAjaxReq.onload = ajaxSuccess;
		oAjaxReq.open("post", url, true);
		oAjaxReq.setRequestHeader("Content-Type", "audio/x-flac; rate=" + sample_rate + ";");
//		oAjaxReq.setRequestHeader("User-Agent", "Mozilla/5.0 (Windows NT 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36;");
		oAjaxReq.withCredentials = true;
		oAjaxReq.send(data);


//		//FIXM russa DEBUG:
//		if(typeof fileNameCounter !== 'undefined'){
//			++fileNameCounter;
//		} else {
//			fileNameCounter = 0;
//		}
//		Recorder.forceDownload(data, 'speechAsr_'+fileNameCounter+'.flac');
//		//FIXM russa DEBUG (END)
		
		return;
	};

	/** initializes the connection to the googleMediator-server, 
	 * where the audio will be sent in order to be recognized.
	 * 
	 * @memberOf GoogleWebAudioInputImpl#
	 */
	var doInitSend = function(oninit){

		//DISABLED: not needed for nuance
	};

	/** @memberOf GoogleWebAudioInputImpl# */
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

	/** @memberOf GoogleWebAudioInputImpl# */
	var onClear = function(evt){

		evt.recorder && evt.recorder.clear();
		return false;
	};

	/** @memberOf GoogleWebAudioInputImpl# */
	var doStopPropagation = function(){
		return false;
	};

	/**  @memberOf GoogleWebAudioInputImpl# */
	return {
		/** @memberOf GoogleWebAudioInputImpl.AudioProcessor# */
		_init: doInitSend,
//		initRec: function(){},
		sendData: doSend,
		oninit: doStopPropagation,
		onstarted: function(data, successCallback, errorCallback){
			successCallback && successCallback('',-1,result_types.RECORDING_BEGIN)
			return false;
		},
		onaudiostarted: doStopPropagation,
		onstopped: function(data, successCallback, errorCallback){
			successCallback && successCallback('',-1,result_types.RECORDING_DONE)
			return false;
		},
		onsendpart: doStopPropagation,
		onsilencedetected: onSilenceDetected,
		onclear: onClear,
		getPluginName: function(){
			return _pluginName;
		},
		setCallbacks: function(successCallbackFunc, failureCallbackFunc, stopUserMediaFunc, options){
			
			//callbacks need to be set in doSend() only
//			successCallback = successCallbackFunc;
//			errorCallback = failureCallbackFunc;
//			var func = stopUserMediaFunc;
			
			currentOptions = options;
		},
		setLastResult: function(){
			lastBlob = true;
		},
		resetLastResult: function(){
			lastBlob = false;
		},
		isLastResult: function(){
			return lastBlob;
		}
	};
		
})();