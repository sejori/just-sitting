var app = require('express')()
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('*', (req, res) => { res.sendFile(__dirname + '/index.html') })

var i = 0;
var questions = [
  'what is/was your most proud achievement of today?',
  'who/what do you appreciate?',
  'use this moment to utilise your breath as an anchor to the present moment...',
  'which emotions can you feel right now?',
  'try exploring the cause of a feeling without judgement',
  'are there any subtle joys surrounding you?',
  'what are you looking forward to?'
]
var sitters = []
var sitterOptions = ["🧘", "🧘🏽", "🧘🏿", "🧘‍♂️", "🧘🏻", "🧘‍♀️", "🧘🏾‍♀️", "🧘🏿‍♀️", "🧘🏻‍♂️", "🧘🏽‍♂️", "🧘🏽‍♀️", "🧘🏼", "🧘🏾‍♂️", "🧘🏼‍♀️", "🧘🏾", "🧘🏼‍♂️", "🧘🏿‍♂️", "🧘🏻‍♀️"]

var interval = setInterval( () => {
  console.log('question ', i)
  console.log(questions[i])
  io.emit('question update', questions[i])
  if (i >= questions.length - 1) i = 0
  else i++
}, 120000)

io.on('connection', (socket) => {
  console.log('a user connected')
  let sitter = "none"
  
  if (sitters.length < sitterOptions.length) {
    sitter = sitterOptions[Math.round(Math.random()*sitterOptions.length-1)]
    while (sitters.includes(sitter)) {
      sitter = sitterOptions[Math.round(Math.random()*sitterOptions.length-1)]
    }
    sitters.push(sitter)
  }
  
  io.emit('sitters', sitters)
  socket.emit("sitter", sitter)
  socket.on('love-button', (sitter) => io.emit('love-button', sitter))
  socket.on('peace-button', (sitter) => io.emit('peace-button', sitter))
  socket.on('disconnect', function(sitter){
    console.log('user disconnected')
    sitters.splice(sitters.indexOf(sitter), 1)
    io.emit('sitters', sitters)
  });
})

http.listen(process.env.PORT || 3333, () => console.log(`Example app listening on port ${process.env.PORT}!`))
