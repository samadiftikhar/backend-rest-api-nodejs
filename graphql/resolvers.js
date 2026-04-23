const validator = require('validator')
const bcrypt = require('bcryptjs')
const { GraphQLError } = require('graphql')
const User = require('../models/user')
const jwt = require('jsonwebtoken')
const Post = require('../models/post')

module.exports = {
    Query: {
        hello: () => 'Hello from GraphQL 🚀',
        posts: async (_, { page, perPage }, { req }) => {

            if (!req.isAuth) {
                throw new GraphQLError('Not authenticated', {
                    extensions: { code: 401 }
                })
            }
            if (!page || page < 1) {
                page = 1
            }
            if (!perPage || perPage < 1) {
                perPage = 2
            }

            const totalPosts = await Post.find().countDocuments()
            const posts = await Post.find().sort({ createdAt: -1 }).populate('creator').skip((page - 1) * perPage).limit(perPage)
            return {
                posts: posts.map(p => ({
                    ...p._doc,
                    _id: p._id.toString(),
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString()
                })),
                totalPosts: totalPosts
            }
        },
        post: async (_, { id }, { req }) => {
            if (!req.isAuth) {
                throw new GraphQLError('Not authenticated', {
                    extensions: { code: 401 }
                })
            }
            const post = await Post.findById(id).populate('creator')
            if (!post) {
                throw new GraphQLError('Post not found', {
                    extensions: { code: 404 }
                })
            }
            return {
                ...post._doc,
                _id: post._id.toString(),
                createdAt: post.createdAt.toISOString(),
                updatedAt: post.updatedAt.toISOString()
            }
        }

    },

    Mutation: {
        createUser: async (_, { userInput }) => {

            const errors = []

            if (!validator.isEmail(userInput.email)) {
                errors.push({ field: 'email', message: 'Invalid email' })
            }

            if (
                validator.isEmpty(userInput.password || '') ||
                !validator.isLength(userInput.password || '', { min: 5 })
            ) {
                errors.push({ field: 'password', message: 'Invalid password' })
            }

            const name = userInput.name?.trim()

            if (!name) {
                errors.push({ field: 'name', message: 'Name is required' })
            } else if (!validator.isLength(name, { min: 6 })) {
                errors.push({ field: 'name', message: 'Name must be at least 6 characters' })
            }

            if (errors.length > 0) {
                throw new GraphQLError('Invalid input data', {
                    extensions: {
                        code: 422,
                        errors
                    }
                })
            }

            const existingUser = await User.findOne({ email: userInput.email })

            if (existingUser) {
                throw new GraphQLError('User already exists', {
                    extensions: { code: 409 }
                })
            }

            const hashedPassword = await bcrypt.hash(userInput.password, 12)

            const user = new User({
                email: userInput.email,
                name: userInput.name,
                password: hashedPassword,
                status: 'I am new!',
            })

            const createdUser = await user.save()

            return {
                ...createdUser._doc,
                _id: createdUser._id.toString(),
                password: null,
            }
        },

        login: async (_, { email, password }) => {

            const user = await User.findOne({ email })

            if (!user) {
                throw new GraphQLError('User not found', {
                    extensions: { code: 404 }
                })
            }

            const isEqual = await bcrypt.compare(password, user.password)

            if (!isEqual) {
                throw new GraphQLError('Incorrect password', {
                    extensions: { code: 401 }
                })
            }

            const token = jwt.sign(
                { userId: user._id.toString(), email: user.email },
                'somesupersecretsecret',
                { expiresIn: '1h' }
            )

            return {
                userId: user._id.toString(),
                email: user.email,
                token
            }
        },
        createPost: async (_, { postInput }, { req }) => {

            if (!req.isAuth) {
                throw new GraphQLError('Not authenticated', {
                    extensions: { code: 401 }
                })
            }

            const { title, content, imageUrl } = postInput

            const errors = []

            if (!title || validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
                errors.push({ field: 'title', message: 'Title is invalid' })
            }

            if (!content || validator.isEmpty(content) || !validator.isLength(content, { min: 5 })) {
                errors.push({ field: 'content', message: 'Content is invalid' })
            }

            if (!imageUrl || validator.isEmpty(imageUrl)) {
                errors.push({ field: 'imageUrl', message: 'Image URL is required' })
            }

            if (errors.length > 0) {
                console.log("VALIDATION ERRORS:", errors) // 🔥 debug
                throw new GraphQLError('Invalid input data', {
                    extensions: {
                        code: 422,
                        errors
                    }
                })
            }

            const user = await User.findById(req.userId)

            const post = new Post({
                title,
                content,
                imageUrl,
                creator: user._id,
            })

            const createdPost = await post.save()

            user.posts.push(createdPost)
            await user.save()

            return {
                ...createdPost._doc,
                _id: createdPost._id.toString(),
                creator: user,
                createdAt: createdPost.createdAt.toISOString(),
                updatedAt: createdPost.updatedAt.toISOString()
            }
        },
        updatePost: async (_, { id, postInput }, { req }) => {
            if (!req.isAuth) {
                throw new GraphQLError('Not authenticated', {
                    extensions: { code: 401 }
                })
            }
            const post = await Post.findById(id).populate('creator')
            if (!post) {
                throw new GraphQLError('Post not found', {
                    extensions: { code: 404 }
                })
            }
            if (post.creator._id.toString() !== req.userId) {
                throw new GraphQLError('Not authorized', {
                    extensions: { code: 403 }
                })
            }
            const { title, content, imageUrl } = postInput

            if (!title || validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
                throw new GraphQLError('Title is invalid', {
                    extensions: { code: 422 }
                })
            }
            if (!content || validator.isEmpty(content) || !validator.isLength(content, { min: 5 })) {
                throw new GraphQLError('Content is invalid', {
                    extensions: { code: 422 }
                })
            }

            post.title = title
            post.content = content
            if (imageUrl && !validator.isEmpty(imageUrl)) {
                post.imageUrl = imageUrl
            }
            const updatedPost = await post.save()
            return {
                ...updatedPost._doc,
                _id: updatedPost._id.toString(),
                creator: updatedPost.creator,
                createdAt: updatedPost.createdAt.toISOString(),
                updatedAt: updatedPost.updatedAt.toISOString()
            }
        },
        deletePost: async (_, { id }, { req }) => {
            if (!req.isAuth) {
                throw new GraphQLError('Not authenticated', {
                    extensions: { code: 401 }
                })
            }
            const post = await Post.findById(id)
            if (!post) {
                throw new GraphQLError('Post not found', {
                    extensions: { code: 404 }
                })
            }
            if (post.creator.toString() !== req.userId) {
                throw new GraphQLError('Not authorized', {
                    extensions: { code: 403 }
                })
            }
            await Post.findByIdAndDelete(id)
            const user = await User.findById(req.userId)
            user.posts.pull(id)
            await user.save()
            return true
        },
    }
}