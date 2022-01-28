const app = require('express')()
const http = require('http').Server(app);
const io = require('socket.io')(http);
const bodyParser = require("body-parser");
const fs = require("fs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// SQLITE3 DB SET-UP
//
// init sqlite db for anon session analytics and feedback responses
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

// if ./.data/sqlite.db does not exist, create it, otherwise print record count in tables to console
db.serialize(() => {
  if (!exists) {
    // CREATE SESSION TABLE (for session analytics)
    db.run("CREATE TABLE Sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, duration TEXT, start TEXT, end TEXT, complete TEXT, session_id TEXT)");
    console.log("New table: Sessions created!");
    // CREATE RESPONSES TABLE (for user feedback)
    db.run("CREATE TABLE Responses (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, session_id TEXT)");
    console.log("New table: Responses created!");
  } else {
    console.log('Database "Responses" ready to go!');
    console.log('Database "Sessions" ready to go!');
    db.each("SELECT MAX(id) from Sessions", (err, row) => console.log(row.id ? `Sessions: ${row.id}` : err));
    db.each("SELECT MAX(id) from Responses", (err, row) => console.log(row.id ? `Responses: ${row.id}` : err));
  }
});


// CLIENT POST ENDPOINTS
//
//
// endpoint to add response to the database
app.post("/postResponse", (request, response) => {
  console.log(`add to responses ${JSON.stringify(request.body)}`);

  const cleansedResponse = JSON.parse(cleanseString(JSON.stringify(request.body)));
  db.run(`INSERT INTO Responses (data, session_id) VALUES (?, ?)`, Object.values(cleansedResponse), error => {
    if (error) {
      console.log(error)
      response.send({ message: "error!" });
    } else {
      response.send({ message: "success" });
    }
  });
});

// CLIENT GET ENDPOINTS
//
app.get("/sessions", async (req, res) => {
  db.all("SELECT * from Sessions", (err, rows) => {
    if (err) res.send(err)
    res.send(JSON.stringify(rows))
  });
});
app.get("/responses", async (req, res) => {
  db.all("SELECT * from Responses", (err, rows) => {
    if (err) res.send(err)
    res.send(JSON.stringify(rows))
  });
});
// default to html file
app.get('*', (req, res) => { res.sendFile(__dirname + '/index.html') })

// INTERNAL SERVER QUESTION LOGIC
let i = 0;
const questions = [
  'what is/was your proudest achievement of today?',
  'who or what do you appreciate?',
  'which emotion do you feel the strongest right now?',
  'try exploring the cause of your feelings without judgement',
  'what subtle joys surround you?',
  'what are you looking forward to?',
  'slowly scan from the top of your head to your toes - how does your body feel?'
]
const interval = setInterval( () => {
  console.log('question ', i)
  console.log(questions[i])
  io.emit('question update', questions[i])
  if (i >= questions.length - 1) i = 0
  else i++
}, 120000)

// WEBSOCKET CONNECTION HANDLING
const sitters = []
const sitterOptions = ["🧘", "🧘🏽", "🧘🏿", "🧘‍♂️", "🧘🏻", "🧘‍♀️", "🧘🏾‍♀️", "🧘🏿‍♀️", "🧘🏻‍♂️", "🧘🏽‍♂️", "🧘🏽‍♀️", "🧘🏼", "🧘🏾‍♂️", "🧘🏼‍♀️", "🧘🏾", "🧘🏼‍♂️", "🧘🏿‍♂️", "🧘🏻‍♀️"]
io.on('connection', (socket) => {
  console.log('a user connected')
  
  // create initial session record for analytics
  const socketUrl = new URL(socket.handshake.headers.referer)
  const startDate = Date.now()
  const duration = socketUrl.pathname.substring(1)
  db.run(
    `INSERT INTO Sessions (duration, start, session_id) VALUES (?, ?, ?)`, 
    [duration, startDate.toString(), socket.id], 
    error => error && console.log(error)
  );
  
  let sitter = "-"
  
  // this logic is funky but it's so there are never duplicate sitters
  if (sitters.length < sitterOptions.length) {
    sitter = sitterOptions[Math.round(Math.random()*sitterOptions.length-1)]
    while (sitters.includes(sitter)) {
      sitter = sitterOptions[Math.round(Math.random()*sitterOptions.length-1)]
    }
  }
  // client only displays up to 9 at a time anyways so just put a whatever character if we run out of emoji options
  sitters.push(sitter)
  
  // send updated sitters to all clients
  io.emit('sitters', sitters)
  // send client sitter to client
  socket.emit("sitter", sitter)
  
  // log session on session end
  socket.on('disconnect', function(sitter) {
    console.log('user disconnected')
    sitters.splice(sitters.indexOf(sitter), 1)
    io.emit('sitters', sitters)
    
    // update session record
    const endDate = Date.now()
    const complete = duration !== "dev"
      ? (endDate - startDate) > Number(duration) * 60000
      : false
    
    db.run(
      `UPDATE Sessions SET end = ?, complete = ? WHERE session_id = ?`,
      [endDate.toString(), complete, socket.id],
      error => error && console.log(error)
    );
  });
})

// helper function that prevents html/css/script malice
const cleanseString = function(string) {
  return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

http.listen(process.env.PORT || 3333, () => console.log(`Example app listening on port ${process.env.PORT}!`))
