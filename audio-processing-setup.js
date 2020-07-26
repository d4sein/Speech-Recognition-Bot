const fs = require('fs')

const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

const pico = require('hotword')
const hotword = fs.readFileSync('bumblebee.ppn')
const wavdecoder = require('wav-decoder')

const { detectAudioIntent } = require('./dialogflow-setup')


async function processAudio(audioStream) {
  return new Promise((resolve, reject) => {
    // Transforms the audio stream into something Dialogflow understands
    let convertedAudio = ffmpeg(audioStream)
      .inputFormat('s32le')
      .audioFrequency(44100)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .format('wav')
      .pipe()
  
    let inputAudio
    let bufs = []
    
    convertedAudio
      .on('data', (chunk) => {
        bufs.push(chunk)
      })
      .on('end', async () => {
        inputAudio = Buffer.concat(bufs)
  
        wavdecoder.decode(inputAudio)
        .then((wav) => {
          let piko = new pico ({
            bumblebee: hotword
          }, wav.sampleRate, async () => {
            let result
  
            try {
              result = await detectAudioIntent(
                inputAudio,
                'AUDIO_ENCODING_LINEAR_16',
                44100
              )
            } catch (err) {
              console.log(err)
              reject(null)
            }
            
            resolve(result)
          })
  
          piko.init()
            .then(() => {
              for (let i = 0; i < wav.channelData[0].length; i += 1024)
              piko.feed(wav.channelData[0].slice(i, i + 1024))
            })
        })
      })
  })
}

module.exports = { processAudio }
