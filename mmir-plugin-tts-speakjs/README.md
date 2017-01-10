# mmir-plugin-tts-speakjs

Cordova plugin for the MMIR framework that adds Text To Speech (TTS) synthesis via `speak.js` library


The speak.js TTS implementation supports the following options (all optional):

`voice` (or `language`): STRING one of `'en-us'` | `'de'` (DEFAULT: `'en-us'`)

and non-standard options:

`amplitude`: NUMBER How loud the voice will be (DEFAULT: 100) 
`pitch`: NUMBER The voice pitch (DEFAULT: 50) 
`speed`: NUMBER The speed at which to talk (words per minute) (DEFAULT: 175) 
`wordgap`: NUMBER Additional gap between words in 10 ms units, i.e. `1` corresponds to a 10 ms duration (DEFAULT: 0) 

## TODO
  
* add fallback for non-WebWorker env
* support cancel? (i.e. during generation)
* compile version with more languages? fr, spa, rus ...?
  * impl. way for dynamically loading language resources?

## speak.js

The plugin uses the `speak.js` library (License GPL-3.0, see [resources/license-speakjs.txt][1]): 
[github.com/logue/speak.js][2].

`speak.js` is compiled from [eSpeak][3] to javascript using `emscripten`.


[1]: resources/license-speakjs.txt
[2]: https://github.com/logue/speak.js
[3]: https://sourceforge.net/projects/espeak/
