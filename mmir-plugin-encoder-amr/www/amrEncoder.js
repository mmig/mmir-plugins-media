
importScripts('workerUtil.js');

/**
 * AMR encoder by cabbage <251949141@qq.com>, MIT license
 * @see https://github.com/twocabbages/amr.js
 */
importScripts('amrnb.min.js');

importScripts('silenceDetector.js');
importScripts('encoder.js');


function AmrEncoder(){
	
	 /**
	  * Different modes / bit rates:
	  * <pre>
	  * MODES	 MR475, MR515, MR59, MR67, MR74, MR795, MR102, MR122, MRSID
	  * -------------------------------------------------------------------
	  * mode:   	0,     1,    2,    3,    4,     5,     6,     7,     8
	  * -> bits:   12, 	  13,   15,   17,   19,    20,    26,    31,     5
	  * </pre>
	  */
	 this.codec = new AMR({mode: 7});
	 this.encoded;
	 this.encoderInit = function(){
		 return;
	 };
	 this.encoderFinish = function(){
		 return;
	 };
	 
	 this.encoderCleanUp = function(){
		 return;
	 };
	 
	 this.encodeBuffer = function(buff){		    
		    var buf_length = buff.length;
			    
		    var minibuffer = Math.floor(2*buf_length/11)+1;
		    var buffer_i16 = new Int16Array(minibuffer);
		    var view = new DataView(buffer_i16.buffer);
		    var volume = 1;
		    var index = 0;
		    var flip = 0;
		    
//		    console.log("Buffer Size: "+buf_length);
//		    console.log("new Buffer Size: "+minibuffer);
		    
		    var counterTest = 0;
		    //for (var i = 0; ; i=i+5+flip){
		    while(counterTest < buf_length){
		        view.setInt16(index, (buff[counterTest] * (0x7FFF * volume)), true);
		        index += 2;
		        flip = (flip+1)%2;
		        counterTest=counterTest+5+flip;
		    }
		    
		    this.encoded = this.codec.encode(buffer_i16,true);
    
	    };
}

//export into global instance variable (see encoder.js for sending/receiving messages on this)
encoderInstance = new AmrEncoder();
