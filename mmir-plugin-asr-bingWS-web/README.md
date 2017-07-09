# mmir-plugin-asr-nuance-web

Cordova plugin for the MMIR framework that allows Automatic Speech Recognition (ASR) via Bing web services

## configure CSP

(e.g. index.html): allow access to https://dictation.nuancemobility.net
```
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https://dictation.nuancemobility.net ...
```


## configuration.json:
```
{

...

	    "bingWsWebAudioInput": {
    		"tokenAddress": "https://api.cognitive.microsoft.com/sts/v1.0/issueToken",
	    	"webSocketAddress": 			"wss://speech.platform.bing.com/speech/recognition/interactive/cognitiveservices/v1",
	    	"appKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
	    	"encoder": "pcmEncoder.js"
    },
	
	....
	
	"mediaManager": {
    	"plugins": {
    		"browser": [
    			...
                {"ctx": "webn", "mod": "webAudioInput", "config": "webasrBingImpl"},
                ...
    		],
    		"cordova": [
    			...
                {"ctx": "webn", "mod": "webAudioInput", "config": "webasrBingImpl"},
                ...
    		]
    	}
    },
...

}
```

## options

supported options for recoginze() / startRecord():
 * language: String
 * results: Number
 * mode: 'search' | 'dictation'

supported custom options for recoginze() / startRecord():
 * appKey: String
 * appId: String
 * codec: 'wav'
 * source: "SpeakerAndMicrophone" | "HeadsetInOut" | "HeadsetBT" | "HeadPhone" | "LineOut"  
          source: Indicates the source of the audio recording.  
		  Properly specifying this header improves recognition accuracy.  
		  Nuance encourages you to pass this header whenever you can -- and as accurately as possible.
