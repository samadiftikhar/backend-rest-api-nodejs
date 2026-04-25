const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const morgan = require('morgan');

const MONGODB_URI =
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.pfh2gud.mongodb.net/${process.env.MONGO_DB}`;

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

const app = express();

// Safe Image Storage
const fileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'images');

        // ensure folder exists (IMPORTANT for Heroku)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        cb(null, dir);
    },

    filename: function (req, file, cb) {
        // FIX: keep file extension (.jpg, .png etc.)
        const ext = path.extname(file.originalname);
        cb(null, uuidv4() + ext);
    }
});

//File Filter
const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === "image/png" ||
        file.mimetype === "image/jpg" ||
        file.mimetype === "image/jpeg"
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

//Logging
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'access.log'),
    { flags: 'a' }
);

app.use(helmet());
app.use(morgan('combined', { stream: accessLogStream }));

// BODY PARSER
app.use(bodyParser.json());

// Multer
app.use(multer({
    storage: fileStorage,
    fileFilter: fileFilter
}).single('image'));

//Static Images
app.use('/images', express.static(path.join(__dirname, 'images')));

//Cors
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Routes
app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

//Error Handling
app.use((error, req, res, next) => {
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;

    res.status(status).json({ message, data });
});

// DB SERVER
mongoose
    .connect(MONGODB_URI)
    .then(result => {
        const server = app.listen(process.env.PORT || 8080);

        const socket = require('./service/socket');
        const io = socket.init(server);

        io.on('connection', socket => {
            console.log("Client connected");
        });

    })
    .catch(err => {
        console.log(err);
    });