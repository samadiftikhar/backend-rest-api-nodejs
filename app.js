const express = require('express')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const cors = require('cors')
const { ApolloServer } = require('@apollo/server')
const { expressMiddleware } = require('@apollo/server/express4')
const auth = require('./middleware/auth')
const typeDefs = require('./graphql/schema')
const resolvers = require('./graphql/resolvers')

const MONGODB_URI =
    'mongodb+srv://root123:root123@cluster0.pfh2gud.mongodb.net/messages'

const startServer = async () => {
    const app = express()

    // =========================
    // APOLLO SERVER
    // =========================
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        formatError: (err) => {
            return {
                message: err.message,
                code: err.extensions?.code || 500,
                data: err.extensions?.data || null,
            }
        }
    })

    await server.start()

    // =========================
    // MIDDLEWARE
    // =========================
    const fileStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'images')
        },
        filename: (req, file, cb) => {
            cb(null, uuidv4())
        },
    })

    const fileFilter = (req, file, cb) => {
        if (
            file.mimetype === 'image/png' ||
            file.mimetype === 'image/jpg' ||
            file.mimetype === 'image/jpeg'
        ) {
            cb(null, true)
        } else {
            cb(null, false)
        }
    }

    app.use(
        cors({
            origin: 'http://localhost:5173',
            credentials: true,
        })
    )

    app.use(bodyParser.json())

    app.use(
        multer({ storage: fileStorage, fileFilter }).single('image')
    )

    app.use('/images', express.static(path.join(__dirname, 'images')))
    app.use(auth)

    app.put('/post-image', auth, (req, res, next) => {
        if (!req.isAuth) {
            return res.status(401).json({ message: 'Not authenticated!' })
        }
        if (!req.file) {
            return res.status(200).json({ message: 'No file provided!' })
        }
        if (req.body.oldPath) {
            clearImage(req.body.oldPath)
        }
        return res.status(201).json({ message: 'File stored.', filePath: req.file.path })
    })

    // =========================
    // GRAPHQL ENDPOINT
    // =========================
    app.use(
        '/graphql',
        express.json(),
        expressMiddleware(server, {
            context: async ({ req }) => {
                return { req }
            }
        })
    )

    // =========================
    // ERROR HANDLER
    // =========================
    app.use((error, req, res, next) => {
        const status = error.statusCode || 500
        const message = error.message
        const data = error.data

        res.status(status).json({ message, data })
    })

    // =========================
    // DB + SERVER START
    // =========================
    mongoose
        .connect(MONGODB_URI)
        .then(() => {
            app.listen(8000, () => {
                console.log('🚀 Server running on http://localhost:8000/graphql')
            })
        })
        .catch((err) => {
            console.log('DB Error:', err)
        })
}

startServer()



const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => {
        console.log(err);
    });
}