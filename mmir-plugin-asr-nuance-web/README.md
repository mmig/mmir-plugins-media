# mmir-plugin-asr-nuance-web

Cordova plugin for the MMIR framework that allows Automatic Speech Recognition (ASR) via Nuance web services

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

	"nuanceWebAudioInput": {
		"encoder": "amr",
		"appId": <the app ID>,
		"appKey": <the secret app key>,
		"baseUrl": "https://dictation.nuancemobility.net/NMDPAsrCmdServlet/dictation"
	},
	
	....
	
	"mediaManager": {
    	"plugins": {
    		"browser": [
    			...
                {"mod": "webAudioTextToSpeech", "config": "webttsNuanceImpl"},
                ...
    		],
    		"cordova": [
    			...
                {"mod": "webAudioTextToSpeech", "config": "webttsNuanceImpl"},
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
 * codec: 'amr' | 'wav'
 * source: "SpeakerAndMicrophone" | "HeadsetInOut" | "HeadsetBT" | "HeadPhone" | "LineOut"  
          source: Indicates the source of the audio recording.  
		  Properly specifying this header improves recognition accuracy.  
		  Nuance encourages you to pass this header whenever you can -- and as accurately as possible.
