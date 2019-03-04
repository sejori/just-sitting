var app = require('express')()
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html') })

var count = 0;
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

var interval = setInterval( () => {
  console.log('question ', i)
  console.log(questions[i])
  io.emit('question update', questions[i])
  if (i >= questions.length - 1) i = 0
  else i++
}, 60000)

io.on('connection', (socket) => {
  console.log('a user connected')
  count += 1
  io.emit('count update', count + " sitting right now.")

  socket.on('love-button', () => io.emit('love-button') )
  socket.on('peace-button', () => io.emit('peace-button') )
  socket.on('disconnect', function(){
    console.log('user disconnected')
      count -= 1
      io.emit('count update', count + " sitting right now.")
  });

})

http.listen(process.env.PORT || 3333, () => console.log(`Example app listening on port 3333!`))
