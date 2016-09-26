# mmir-plugins-media

media plugins for the MMIR framework (e.g. for speech input, output etc)

see also [documentation in the Wiki][1]

## Install As Cordova Plugin

using Cordova command-line-interface for installing plugin `mmir-plugin-XXX-XXXXXX-web`, use:

```
cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-XXX-XXXXXX-web
```

Note that if you want to use the plugins ( installed as Cordova Plugins) in a browser,
you also need to install the `browser` platform, e.g. `cordova platform add browser`.


    ASR (Automatic Speech Recognition)
      cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-google-web
      cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-nuance-web
      [outdated] cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-atnt-web
      [outdated] cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-googlev1-web
    
    TTS (Text To Speech)
      cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-tts-nuance-web
    
    Audio Encoder
    NOTE: these are usually automatically installed when needed (via dependency declaration)
      cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-encoder-amr
      cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-encoder-flac
      cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-encoder-core


## Install As Resources in WWW

Since these plugins are pure HTML/JavaScript implementations, they can be
installed directly into the Cordova's `/www` directory.
The media-plugins support this option via nodejs' package manager `npm`.

### Prerequisites

npm version >= 2.0

check npm version with `npm -v`.

### Installation

The media-plugins are setup as a _monorepo_, which is not directly supported by `npm`.

For this reason, the media-plugins need to be installed from a local directory, instead of the git repo.

That means, that the the git repo needs to be `clone`d  once, and then the depedencies need to be declared
in relation to the local git repo direoctories.

#### Clone mmir-pluings-media

In the Cordova projects root, clone the media-plugins repo to a sub-directory, e.g. to `build/repo/mmir-plugins-media`.


`git clone https://github.com/mmig/mmir-plugins-media.git build/repo/mmir-plugins-media`


This can be directly combined with installing a media-plugin, e.g. for installing `mmir-plugin-asr-nuance-web`: 
`git clone -q https://github.com/mmig/mmir-plugins-media.git build/repo/mmir-plugins-media & npm install build/repo/mmir-plugins-media/mmir-plugin-asr-nuance-web`

(if the git repo already exists, an error message will be printed, that repo could not be cloned again)


Cloning the media-plugins repo needs to be done only once. For _"updating"_ the plugins, the repo would need
to be _pulled_ and the the plugins re-installed.



#### Installing media-plugins

Create a [package.json][2] file in the Cordova project, in which you want to use a media-plugin.

Then declare the media-plugin(s) as `dependency` (or `devDependencies`) 
in `package.json` and install them.

For example, if the media-plugins repo was cloned to `build/repo/mmir-plugins-media`

```
  ...
  "devDependencies": {
	"mmir-plugin-asr-nuance-web": "build/repo/mmir-plugins-media/mmir-plugin-asr-nuance-web"
  },
  ...
```
(i.e. reference to `<repo path>/<plugin name>` in the local file system)


Then install the media-plugins using nodejs' `npm`:

`npm install`

This will install the media-plugins with all their dependencies in `/node_modules`, and then copy the media-plugin's
implementation-files into the Cordova project's `/www` directory.

### Removal

`npm` can also be used for removing the files of an installed media-plugin from the project's  `/www`,
directory (and from `node_modules`):

`npm uninstall <id>`

e.g.

`npm uninstall mmir-plugin-asr-nuance-web`

would remove all the media-plugin's files (and the files from its dependencies) from `/www`
and from `/node_modules`.


## Current Speech Plugins

----
### Automatic Speech Recognition (ASR)

#### Google v2 Web Service

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-google-web


#### Nuance HTTP Web Service

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-nuance-web


#### WebSpeech API

The media-plugin for the _WebSpeech API_ is already included in the `mmir-lib`. 
_(NOTE currently, only the Google Chrome browser supports an implementation for the _WebSpeech API_)_


> #### [outdated]
> 
> ##### AT&T Web Servie (outdated)
> 
>     cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-atnt-web
> 
> ##### Google v1 Web Service (outdated)
> 
>     cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-asr-googlev1-web
> 

----
### Text To Speech (TTS)

#### Nuance HTTP Web Service

    cordova plugin add https://github.com/mmig/mmir-plugins-media.git#master:mmir-plugin-tts-nuance-web


#### MARY HTTP Web Service

The media-plugin for the _MARY TTS web service_ is already included in the `mmir-lib`. 

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
[2]: https://docs.npmjs.com/files/package.json
