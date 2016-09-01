# mmir-plugins-media

media plugins for the MMIR framework (e.g. for speech input, output etc)

see also [documentation in the Wiki][1]

## Install Cordova Plugin

using Cordova command-line-interface for installing plugin `mmir-plugin-XXX-XXXXXX-web`, use:

```
cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-XXX-XXXXXX-web
```

## Current Speech Plugins

----
### Automatic Speech Recognition (ASR)

#### Google v2 Web Service

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-google-web


#### Nuance HTTP Web Service

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-nuance-web


#### [outdated]

##### AT&T Web Servie (outdated)

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-atnt-web

##### Google v1 Web Service (outdated)

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-googlev1-web


----
### Text To Speech (TTS)

Nuance HTTP Web Service

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-tts-nuance-web


----
### Core and Encoders
_these usually do not need to be added manually, they will be automatically
be installed when needed (via the dependency declaration in the referencing plugin)_

#### Core

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-encoder-core

#### AMR/Speex Encoder

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-encoder-amr

#### FLAC Encoder

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-encoder-flac


[1]: https://github.com/mmig/mmir/wiki/3.9.2-Speech-Processing-in-MMIR#speech-modules
