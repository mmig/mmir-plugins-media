/*
 * 	Copyright (C) 2012-2013 DFKI GmbH
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


  
  var mmir = window.mmir ||
  {};

  var Application = function(){
      this.name = "Application";
      
      //stub for simulating user-registry
      this.registerUsers = new Object();
      
      //register the default user, using the default values in login-view
      // (NOTE: really, you should never store passwords in plain text!)
      this.registerUsers['MMIG-User'] = 'mmig-user';
  };


  Application.prototype.on_page_load = function (){
	  
	  //set-up render for microphone-levels
	  mmir.app.renderer.initPage();
	  
  };
  
  Application.prototype.on_page_load_login = function (){
		
		var self = this;
		
		//handle language selection:
		$('#languageListView li')
			.bind('vmousedown',           function(){	
				$(this).addClass(	'ui-focus ui-btn-active ui-btn-down-a');
			})
			.bind('vmouseup vmousecancel',function(){
				$(this).removeClass('ui-focus ui-btn-active ui-btn-down-a');
			})
			//
			//NOTE: we need to use 'click' here due to default event-handling of browser
			//		  touchend -> tap/vclick -> click [delayed]
			//		when using tap or vclick here, the click event is triggered,
			//		regardless whether or not the tap/vclick.event.preventDefault()
			//		is invoked
			//		=> if there is a clickable element "under" the the clicked item of
			//		the language menu, it will be triggered after the language menu closes!
			//		Using the click event here does not have this side effect, obviously.
			//
			.bind('click', function(event){
		
				var lang = $(this).attr('lang');
		
				//see app.js:
				mmir.app.triggerClickFeedback();
		
				var isChanged = self.changeLanguage(lang);
				
				mmir.InputManager.raise('touch_input_event');
				mmir.InputManager.raise('language_choosen', {changed: isChanged});
				
				return false;
		});
		
		//handle click on language-button in footer
		$('#lang_button').on('vclick', function(e){
			e.preventDefault();

			mmir.app.triggerClickFeedback();
			
			mmir.InputEngine.raise('touch_input_event');
			mmir.InputEngine.raise('click_on_language_btn');
			return false;
		});
		
		//handle click on modal-layer
		// (visible when language menu is open)
		$('#modal').on('vclick', function(e){
			e.preventDefault();

			mmir.app.triggerClickFeedback();
			
			self.slide_up_language_menu();
			return false;
		});
		
//		this.initAsrTestInput();
	      
	    this.initSpeechInputTest();
	};

  Application.prototype.initAsrTestInput = function(){

		//TODO need to track ASR active/inactive state across pages
	    //     cancel ASR on page-change (and app-pause)?

		var isAsrActive = false;
		
		var setActive = function(button, setToActive){
			var label = 'start';
			var theming = 'a';//<- jQuery UI theme
			if(setToActive === true){
				label = 'stop';
				theming = 'b';
			}
			
			//use jQuery Mobile function to change button-label:
			button.text(label);

			//change theme (i.e. marking as active/inactive)
			button.buttonMarkup({theme: theming});
		};
		
		$('#asr').on('vclick', function(event) {
			
			//switch ASR activation state
			
			
			//set text in textarea
			var textElement = $('#asr-text');
			
			
			//text += ' set-ASR-to_'+(isAsrActive? 'active' : 'INactive');
			if (!isAsrActive){
				mmir.MediaManager.getInstance().startRecord(function(text, idInfo){
						var textSoFar = textElement.val();
						textSoFar += ' '+ text;
						textElement.val( textSoFar );
					}, function(e){
						console.error('Error using startRecord: '+ e);
					}
					, true //isUseIntermediateResultsMode
					);
			} else {
				mmir.MediaManager.getInstance().stopRecord(function(text, idInfo){
						var textSoFar = textElement.val();
						textSoFar += ' '+ text;
						textElement.val( textSoFar );
					}, function(e){
					console.error('Error using stopGetRecord: '+e);
				});
					
			}
			
			
			isAsrActive = ! isAsrActive;
			//change button in order to indicate active/inactive ASR state
			setActive( $('#asr'), isAsrActive);
		});
		
		$('#asr-normal').on('vclick', function(event) {
			
			//switch ASR activation state
			
			
			//set text in textarea
			var textElement = $('#asr-text');
			
			
			//text += ' set-ASR-to_'+(isAsrActive? 'active' : 'INactive');
			if (!isAsrActive){
				mmir.MediaManager.getInstance().startRecord(function(text, idInfo){
						var textSoFar = textElement.val();
						textSoFar += ' '+ text;
						textElement.val( textSoFar );
					}, function(e){
						console.error('Error using startRecord: '+ e);
					}
					, true //isUseIntermediateResultsMode
					);
			} else {
				mmir.MediaManager.getInstance().stopRecord(function(text, idInfo){
						var textSoFar = textElement.val();
						textSoFar += ' '+ text;
						textElement.val( textSoFar );
					}, function(e){
					console.error('Error using stopGetRecord: '+e);
				});
					
			}
			
			
			isAsrActive = ! isAsrActive;
			//change button in order to indicate active/inactive ASR state
			setActive( $('#asr-normal'), isAsrActive);
		});
		
		$('#clear').on('vclick', function(event) {
			$('#asr-text').val('');
		});  
  };
  
  Application.prototype.login = function(){
      var email = $('#emailField #email').val();
      var password = $('#passwordField #password').val();
      if(this.verify(email,password)){
    	  mmir.ModelManager.getModel('User').create(email);
    	  mmir.DialogManager.raise("user_logged_in");
      }
      else {
    	  alert('Wrong user name or password.\n\nDir you register?');
    	  mmir.DialogManager.raise("login_failed");
      }
  };

  Application.prototype.register = function(){
      var email = $('#registration-form #email').val();
      var password = $('#registration-form #password').val();
      
      this.registerUsers[email] = password;
      mmir.ModelManager.getModel('User').create(email);
 	  
      mmir.DialogManager.raise("user_logged_in");
  };
  
  Application.prototype.verify = function(name, pw){
	  if(typeof this.registerUsers[name] === 'string'){
		  return pw === this.registerUsers[name];
	  }
	  return false;
  };
  

  Application.prototype.slide_down_language_menu = function() {
	  var langMenu = $('#language-menu-panel');
	  langMenu.slideDown(function(){$('#modal').show();});
  };

  Application.prototype.slide_up_language_menu = function() {
	  $('#modal').hide();
	  $('#language-menu-panel').slideUp();
  };

  /**
   * 
   * This function changes the application language.
   * 
   * NOTE: the current view needs to updated separately (if necessary).
   * 
   * @function changeLanguage
   * @param {String} newLang The new language which is to be used
   * @returns {Boolean} <code>true</code> if the language has change, <code>false</code> otherwise
   * @public
   */
  Application.prototype.changeLanguage = function(newLang) {

	  console.debug("[Language] selected " + newLang);//debug

	  var currLang = mmir.LanguageManager.getInstance().getLanguage();
	  var newLang = mmir.LanguageManager.getInstance().setLanguage(newLang);
	  
	  //also set the new language for jqm plugin datebox:
	  jQuery.mobile.datebox.prototype.options.useLang = newLang;
	  
	  return currLang != newLang;
  };
  

  
  //////////////////////////////////////////////////// speech input test //////////////////////////////////////////////////
  
  
  Application.prototype.initSpeechInputTest = function initSpeechInputTest(){

		
		var self = this;
		
		self.isAsrActive = false;
		
//		$('#asr,#clear').button();
		
		////////////// VIZ ////////////////
		self.initSpeechInputViz();
		
		var setActive = function(button, setToActive){
			var label = 'start';
			var theming = 'c';//<- jQuery UI theme
			if(setToActive === true){
				label = 'stop';
				theming = 'b';
			}
			
			//use jQuery Mobile function to change button-label:
			button.text(label);//.button('refresh');

			//change theme (actually, we need to change the button's parent theme)
			button.buttonMarkup({theme: theming});
		};
		
		$('#asr').on('vclick', function(event) {
			
			mmir.app.triggerClickFeedback({audio:false});
			
			//switch ASR activation state
			
			
			//set text in textarea
			var textElement = $('#asr-text');
			
			
			if (!self.isAsrActive){
				mmir.MediaManager.startRecord(function(text, idInfo){
						var textSoFar = textElement.val();
						textSoFar += ' '+ text;
						textElement.val( textSoFar );
						
						self.asrPartialResult(text);
						
					}, function(e){
						console.error('Error using startRecord: '+ e);
					}
					, true //isUseIntermediateResultsMode
					);
			} else {
				mmir.MediaManager.stopRecord(function(text, idInfo){
						var textSoFar = textElement.val();
						textSoFar += ' '+ text;
						textElement.val( textSoFar );

						self.asrPartialResult(text);
						
					}, function(e){
					console.error('Error using stopGetRecord: '+e);
				});
					
			}
			
			
			self.isAsrActive = ! self.isAsrActive;
			//change button in order to indicate active/inactive ASR state
			setActive( $('#asr'), self.isAsrActive);
		});
		
		$('#clear').on('vclick', function(event) {
			mmir.app.triggerClickFeedback();
			$('#asr-text').val('');
		});
		
		
		cancelSpeechInputOnPageChange = function(){
			
			if(self.isAsrActive){
				mmir.MediaManager.cancelRecognition(function(){
					console.info('Canceled speech input.');
				}, function(e){
					console.error('Error canceling speech recoginition: '+e);
				});
			}
			//remove this handler -> we only need it this once!
			jQuery(document).off( "pagebeforehide", cancelSpeechInputOnPageChange);
		};
		jQuery(document).on( "pagebeforehide", cancelSpeechInputOnPageChange);
};

//NOTE visualization is currently only supported in BROWSER env
Application.prototype.initSpeechInputViz = function initSpeechInputViz(){
	  
	  if(! require('env').isBrowserEnv ){
		  return;
	  }
	  
	  //NOTE: vizalization code taken from http://webaudiodemos.appspot.com/AudioRecorder/
	  //      Copyright (C) 2013 Matt Diamond (MIT License)
	  
	  if (!navigator.cancelAnimationFrame)
		  navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
	  if (!navigator.requestAnimationFrame)
		  navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

	  var initAnalyzers, updateAnalysers, analyserContext, canvasWidth, canvasHeight, rafID,
	  		cancelAnalyserUpdates, recorder, noiseTreshold;
	  var self = this;
	  
	  initAnalyzers = function(isWaveformVisualization){
		  var inputElement = $('#asr-text');
		  //DISABLE if the inputElement is not present -> this is probably the wrong view...
		  if(inputElement.length < 1){
//			  mediaManager.removeListener('webaudioinputstarted',onAllowRecordHandler);
			  return;
		  }
		  
		  if( $('#analyser').length < 1){
			  var elemWidth = Math.min(800, inputElement.width());
			  var elemStr = '<canvas id="analyser" width="'+elemWidth+'" height="150" style="border: solid gray 2px;"></canvas>';
			 
			  if(isWaveformVisualization){
				  elemStr = '<div>'+elemStr+'<br><span><u>Legend:</u> '
					  	+'<span style="color: green;">audio amplitude</span>, '
					  	+'<span style="color: red;">silence detection limits</span>; '
					  	+'<br> and on detected end-of-sentence the border will change '
					  		+'<span style="border: solid gray 2px;">from</span> &rarr; '
					  		+'<span style="border: solid orange 2px;">to</span> (i.e. Speech Recognition is triggered)'
				  	+'</span></div>';
				  
			  }
			  
			  $(elemStr).insertBefore(inputElement);  
		  }

		  var canvas = document.getElementById("analyser");
		  canvasWidth = canvas.width;
		  canvasHeight = canvas.height;
		  analyserContext = canvas.getContext('2d');
		  
		  if(isWaveformVisualization){
			  noiseTreshold = mmir.ConfigurationManager.get(["silenceDetector.noiseTreshold"]);
			  $('#clear').on('vclick', function(){
				  analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
			  });
		  }
	  };
	  
	  var getAnalyserFrequencyData = function getAnalyserFrequencyDataBROWSER(){
		  if(!self.analyserNode){
			  new Uint8Array(0);
		  }
		  else {
			  var data = new Uint8Array(self.analyserNode.frequencyBinCount);
			  self.analyserNode.getByteFrequencyData(data);
			  return data;
		  }
	  };
	  
	  var freqVisualizer = function updateFreqAnalyser(time) {
		  if (!analyserContext) {
			  initAnalyzers(false);
		  }

		  // analyzer draw code here
		  {
			  var SPACING = 3;
			  var BAR_WIDTH = 1;
			  var numBars = Math.round(canvasWidth / SPACING);
//			  var freqByteData = new Uint8Array(self.analyserNode.frequencyBinCount);
//
//			  self.analyserNode.getByteFrequencyData(freqByteData);
			  
			  var freqByteData = getAnalyserFrequencyData();

			  analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
			  analyserContext.fillStyle = '#F6D565';
			  analyserContext.lineCap = 'round';
			  var multiplier = freqByteData.length / numBars;//self.analyserNode.frequencyBinCount / numBars;

			  // Draw rectangle for each frequency bin.
			  for (var i = 0; i < numBars; ++i) {
				  var magnitude = 0;
				  var offset = Math.floor( i * multiplier );
				  // gotta sum/average the block, or we miss narrow-bandwidth spikes
				  for (var j = 0; j< multiplier; j++)
					  magnitude += freqByteData[offset + j];
				  magnitude = magnitude / multiplier;
				  var magnitude2 = freqByteData[i * multiplier];
				  analyserContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
				  analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
			  }
		  }

		  rafID = window.requestAnimationFrame( updateAnalysers );
	  };
	  
	  var drawWaveform = function drawBuffer( width, height, context, data , analyzerWindowSize) {
		  if(! data || data.length < 1){
			  //console.error('drawWaveform: no data for visualization!');
			  return;
		  }
		  
		  
		  //use a "window" for processing
		  var size = data.length;
		  // ...if buffer is smaller than the window, use the whole buffer instead
		  var len = analyzerWindowSize < size ? analyzerWindowSize : size;
		  
		  var step = Math.ceil( len / width );
		  
		  //start index for the analyzer window
		  var dataStartIndex = data.length - len;
		  var drawStartIndex = analyzerWindowSize < size ? 0 : width - Math.ceil(len / step);
		  

		  context.clearRect(drawStartIndex,0, width-drawStartIndex, height);
		  
		  var amp = height / 2;
		  context.fillStyle = "green";
		  for(var i=drawStartIndex; i < width; i++){
			  var min = 1.0;
			  var max = -1.0;
			  for (var j=0; j<step; j++) {
				  var datumIndex = ((i) *step) + (j+dataStartIndex);
				  var datum = data[datumIndex]; 
				  if (datum < min)
					  min = datum;
				  if (datum > max)
					  max = datum;
			  }
			  context.fillRect(i,(1+min)*amp,1,Math.max(1,(max-min)*amp));
		  }
		  
		  //draw noise-detection viz:
		  context.fillStyle = "red";
		  var noiseTresholdY = noiseTreshold * amp;
		  context.fillRect(0,amp - noiseTresholdY,width,1);
		  context.fillRect(0,amp + noiseTresholdY,width,1);
	  };
	  
	  var wavfromVisualizer = function updateWaveformAnalyser(){
		    
		    if (!analyserContext) {
		    	initAnalyzers(true);
			  }

			  // analyzer draw code here
			  {
//				    var canvas = document.getElementById( "wavedisplay" );
//				    drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), buffers[0] );
				    
				  	if(self.isAsrActive){
					    recorder.getBuffers(function(buffers){
					    	drawWaveform( canvasWidth, canvasHeight, analyserContext, buffers[0], 50000 );
					    }, true);
				  	}
				    
			  }

			  rafID = window.requestAnimationFrame( updateAnalysers );
	  };
	  
	  updateAnalysers = wavfromVisualizer;//freqVisualizer;

	  var onAllowRecordHandler = function(recordingStream, audioContextImpl, recorderInstance){
		  ///////////////////// VIZ ///////////////////
		  var inputPoint = audioContextImpl.createGain();

		  recorder = recorderInstance;
		  
		  recordingStream.connect(inputPoint);

//		  audioInput = convertToMono( recordingStream );

		  self.analyserNode = audioContextImpl.createAnalyser();
		  self.analyserNode.fftSize = 2048;
		  inputPoint.connect( self.analyserNode );

//		  audioRecorder = new Recorder( inputPoint );
//		  recorder = new Recorder(inputPoint, {workerPath: recorderWorkerPath});

		  zeroGain = audioContextImpl.createGain();
		  zeroGain.gain.value = 0.0;
		  inputPoint.connect( zeroGain );
		  zeroGain.connect( audioContextImpl.destination );
		  updateAnalysers();
		  ///////////////////// VIZ ///////////////////
	  };
	  
	  // EXPERIMENTAL Android visualization ////////////////////////////////////////////////////////////// 
	  // (NOTE: need to disable forBrowser-switch at start of function initSpeechInputViz()!)
	  if( ! require('env').isBrowserEnv){
		  
		  var freqData = new Uint8Array(0);
		  
		  //since we need to pull the data asynchronously, we redirect the visualizer-call:
//		  var doVizFreq = freqVisualizer;
		  var doVizFreq = function updateWaveformAnalyserANDROID(){
			    
			    if (!analyserContext) {
			    	initAnalyzers(true);
				  }

				  // analyzer draw code here
				  {
//					    var canvas = document.getElementById( "wavedisplay" );
//					    drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), buffers[0] );
					    
					  	if(self.isAsrActive){
						    drawWaveform( canvasWidth, canvasHeight, analyserContext, freqData, 50000 );
					  	}
					    
				  }

				  rafID = window.requestAnimationFrame( updateAnalysers );
		  };
		  
		  //... and for the original visualizer-call, we retrieve the data:
		  var getAnalyserFrequencyDataANDROID = function getAnalyserFrequencyDataANDROID(){
			  
			  plugins.soundVisualizer.getData(
				  function(data){

//				  	  console.debug('getAnalyserFrequencyDataANDROID retrieved data from sound-visualizer ('+data.length+')');//: '+JSON.stringify(data));
					  
					  var uintData = new Uint8Array(data.length);
					  uintData.set(data);
					  freqData =  uintData;
					  
					  //call the actuall visualizer:
					  doVizFreq();
				  },
				  function(err){
				  	  console.error('ERROR retrieving data from sound-visualizer: '+err);
				  	  freqData = new Uint8Array(0);

					  //call the actuall visualizer:
				  	  doVizFreq();
				  }
			  );
		  };
		  freqVisualizer = getAnalyserFrequencyDataANDROID;
		  wavfromVisualizer = getAnalyserFrequencyDataANDROID;
		  updateAnalysers = getAnalyserFrequencyDataANDROID;
		  
		  //the getter for the data, then just returns, what the retrieval-call pulled from the android plugin:
		  getAnalyserFrequencyData = function(){
			  return freqData;
		  };
		  
		  if(! window.requestAnimationFrame){
			  window.requestAnimationFrame = function(callback){
//			  	  console.debug('invoking fallback for requestAnimationFrame on ('+callback.name+')...');
				  return setTimeout(callback, 20);
			  };
			  

			  window.cancelAnimationFrame = function(id){
				  clearTimeout(id);
			  };
		  }

		  plugins.soundVisualizer.init( 2028,
			  function(){
			  
				  plugins.soundVisualizer.start(function(){
						  updateAnalysers();
					  },
					  function(err){
					  		console.error('ERROR starting sound-visualizer: '+err);
					  }
				  ); 
				  
		  	},
		  	function(err){
		  		console.error('ERROR initializing sound-visualizer: '+err);
		  	}
		  );
	  }
	  
	  var mediaManager = mmir.MediaManager;
	  

	  if(typeof MEDIA_ON_ALLOW_RECORD_LISTENER !== 'undefined' && MEDIA_ON_ALLOW_RECORD_LISTENER){
		  mediaManager.removeListener('webaudioinputstarted', MEDIA_ON_ALLOW_RECORD_LISTENER);
		  var dummy = MEDIA_ON_ALLOW_RECORD_LISTENER();
		  if(dummy){
			  onAllowRecordHandler(dummy.recordingStream, dummy.audioContext, dummy.recorderInstance);
			  delete MEDIA_AUDIO_CONTEXT;
			  delete MEDIA_RECORDING_STREAM;
			  delete MEDIA_RECORDER_INSTANCE;
		  }
		  delete MEDIA_ON_ALLOW_RECORD_LISTENER;
	  }
	  
	  mediaManager.addListener('webaudioinputstarted', onAllowRecordHandler);
	  
	  mediaManager.addListener('ondetectsentence', function(blob, inputId){
//		  Recorder.forceDownload( blob, "myRecording" + ((inputId<10)?"0":"") + inputId + ".wav" );
		  $('#analyser').css({'border-color':'orange'});
		  setTimeout(function(){ $('#analyser').css({'border-color':'gray'}); }, 1000);
	  });

	  cancelAnalyserUpdates = function cancelAnalyserUpdates() {
		  window.cancelAnimationFrame( rafID );
		  rafID = null;
	  };
	  
	  var pageLeaveListener = function( event ) {
		  cancelAnalyserUpdates();
		  analyserContext = null;
		  setTimeout(function(){ jQuery(document).off("pagebeforehide", pageLeaveListener); }, 50);
	  };
	  jQuery(document).on( "pagebeforehide", pageLeaveListener);
	  
	  //NOTE the first time, updateAnalysers() will be invoked when getUserMedia was accepted by user
	  //	 (i.e. in listener callback getStartRecordListener() above -- actually this listener should be added in main.js on initilization, before the user has a chance to click the 'accept getUserMedia' button in the browser... it works here, because it is the very first view)
	  //	After that we need to restart the animation by calling updateAnalysers() on entering the view
	  //	(we know the visualizer is initialized and we can call updateAnalysers(), 
	  //	 when we have a valid self.analyserNode object)
	  if(self.analyserNode){
		  updateAnalysers();
	  }
};


Application.prototype.asrPartialResult = function (asr){

	  var statusElem = $('#asr-status');
	  
	  statusElem.html(
			  '<code>&gt;<span style="color: darkred;background-color: #FFE7E7;border: 1px solid darkred;">'+ asr+'</span>&lt;</code>');
	  
	  statusElem.animate({
		  opacity: "show"
	  }, {
		  duration: "slow",
		  complete: function(){
			  $(this).animate({
				  opacity: "hide"
			  }, {
				  duration: "slow"
			  });
		  }
	  });
};