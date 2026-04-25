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

/* -------------------- SECURITY HEADERS (FIX CORP ISSUE) -------------------- */
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // 🔥 FIX
    next();
});

/* -------------------- HELMET -------------------- */
app.use(
    helmet({
        crossOriginResourcePolicy: false, // IMPORTANT: disable helmet default CORP
    })
);

/* -------------------- LOGGING -------------------- */
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'access.log'),
    { flags: 'a' }
);

app.use(morgan('combined', { stream: accessLogStream }));

/* -------------------- BODY PARSER -------------------- */
app.use(bodyParser.json());

/* -------------------- FILE STORAGE -------------------- */
const fileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'images');

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },

    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, uuidv4() + ext);
    }
});

/* -------------------- FILE FILTER -------------------- */
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

/* -------------------- MULTER -------------------- */
app.use(
    multer({
        storage: fileStorage,
        fileFilter: fileFilter
    }).single('image')
);

/* -------------------- STATIC IMAGES (IMPORTANT FIX HERE) -------------------- */
app.use(
    '/images',
    express.static(path.join(__dirname, 'images'), {
        setHeaders: (res) => {
            res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // 🔥 important
        }
    })
);

/* -------------------- CORS -------------------- */
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

/* -------------------- ROUTES -------------------- */
app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

/* -------------------- ERROR HANDLING -------------------- */
app.use((error, req, res, next) => {
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;

    res.status(status).json({ message, data });
});

/* -------------------- DB + SERVER -------------------- */
mongoose
    .connect(MONGODB_URI)
    .then(() => {
        const server = app.listen(process.env.PORT || 8080);

        const socket = require('./service/socket');
        const io = socket.init(server);

        io.on('connection', (socket) => {
            console.log("Client connected");
        });
    })
    .catch(err => {
        console.log(err);
    });