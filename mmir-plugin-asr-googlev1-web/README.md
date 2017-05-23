# mmir-plugin-asr-googlev1-web

Cordova plugin for the MMIR framework that allows Automatic Speech Recognition (ASR) 
via Google web speech recognition services (v1)

NOTE: requires WebSocket mediator (server component) for accessing the Google Web Speech Recognition service v1

**WARNING** deprecated: Google does not provide the Web Speech Recognition service v1 anymore! 


supported options for recoginze() / startRecord():
 * language: String

supported custom options for recoginze() / startRecord():
 * webSocketAddress
 * silenceBuffer
