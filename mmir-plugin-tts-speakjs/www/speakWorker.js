/*
 * speak.js
 * https://github.com/logue/speak.js
 * License: GPL-3.0
 */

importScripts('speakGenerator.js');

onmessage = function(event) {
  postMessage(generateSpeech(event.data.text, event.data.args));
};

