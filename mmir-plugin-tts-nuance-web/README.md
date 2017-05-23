# mmir-plugin-tts-nuance-web

Cordova plugin for the MMIR framework that adds Text To Speech (TTS) synthesis via Nuance web services


## configure CSP

(e.g. index.html): allow access to https://tts.nuancemobility.net
```
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https://tts.nuancemobility.net ...
```


## configuration.json:
```
{

...

	"nuanceHttpTextToSpeech": {
      "appId": <the app ID>,
      "appKey": <the secret app key>,
      "baseUrl": "https://tts.nuancemobility.net:443/NMDPTTSCmdServlet/tts"
    },
	
	....
	
	"mediaManager": {
    	"plugins": {
    		"browser": [
    			...
                {"mod": "webAudioInput", "config": "webasrNuanceImpl"},
                ...
    		],
    		"cordova": [
    			...
                {"mod": "webAudioInput", "config": "webasrNuanceImpl"},
                ...
    		]
    	}
    },
...

}
```

supported options for recoginze() / startRecord():
 * language: String

supported custom options for recoginze() / startRecord():
 * appKey: String
 * appId: String
