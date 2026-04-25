const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');

const Post = require('../models/post');
const User = require('../models/user');

exports.getPost = async (req, res, next) => {
    const postId = req.params.postId;
    try {
        const post = await Post.findById(postId).populate('creator', 'name')
        if (!post) {
            const error = new Error('could not find post');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            post: post
        });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }

};

exports.getPosts = async (req, res, next) => {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 10;
    let totalItems;
    try {
        const totalItems = await Post.find().countDocuments()
        const posts = await Post.find()
            .populate('creator', 'name') // ✅ ADD THIS
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: 'posts fetched successfully',
            posts: posts,
            totalItems: totalItems
        });
    } catch (error) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.createPost = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('validation failed, entered data is incorrect');
        error.statusCode = 422;
        throw error;
    }

    if (!req.file) {
        const error = new Error('no image provided');
        error.statusCode = 422;
        throw error;
    }

    const title = req.body.title;
    const content = req.body.content;
    const imageUrl = 'images/' + req.file.filename;

    const post = new Post({
        title,
        content,
        imageUrl,
        creator: req.userId,
    });

    try {
        await post.save();

        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('user not found');
            error.statusCode = 404;
            throw error;
        }

        user.posts.push(post);
        await user.save();

        // ✅ SOCKET EMIT
        const io = require('../service/socket').getIO();
        io.emit('posts', {
            action: 'create',
            post: post,
            creator: { _id: user._id, name: user.name },
            source: 'server'
        });



        res.status(201).json({
            message: 'post created successfully',
            post: post,
            creator: { _id: user._id, name: user.name }
        });

    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.updatePost = async (req, res, next) => {
    const postId = req.params.postId;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('validation failed, entered data is incorrect');
        error.statusCode = 422;
        throw error;
    }
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;
    if (req.file) {
        imageUrl = `images/` + req.file.filename;
    }
    if (!imageUrl) {
        const error = new Error('no file picked');
        error.statusCode = 422;
        throw error;
    }
    try {
        const post = await Post.findById(postId).populate('creator');
        if (!post) {
            const error = new Error('could not find post');
            error.statusCode = 404;
            throw error;
        }
        if (post.creator._id.toString() !== req.userId) {
            const error = new Error('not authorized');
            error.statusCode = 403;
            throw error;
        }

        if (imageUrl !== post.imageUrl) {
            clearImage(post.imageUrl);
        };
        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        const result = await post.save();

        // 🔥 SOCKET EMIT
        const io = require('../service/socket').getIO();

        io.emit('posts', {
            action: 'update',
            post: result,
            creator: { _id: post.creator._id, name: post.creator.name }
        });

        res.status(200).json({
            message: 'post updated',
            post: result,
            creator: { _id: post.creator._id, name: post.creator.name }
        });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }

};

exports.deletePost = async (req, res, next) => {
    const postId = req.params.postId;

    try {
        const post = await Post.findById(postId);

        if (!post) {
            const error = new Error('could not find post');
            error.statusCode = 404;
            throw error;
        }

        if (post.creator.toString() !== req.userId) {
            const error = new Error('not authorized');
            error.statusCode = 403;
            throw error;
        }

        clearImage(post.imageUrl);

        await Post.findByIdAndDelete(postId);

        const user = await User.findById(req.userId);
        user.posts.pull(postId);
        await user.save();

        // 🔥 SOCKET EMIT (REAL-TIME DELETE)
        const io = require('../service/socket').getIO();

        io.emit('posts', {
            action: 'delete',
            postId: postId
        });

        res.status(200).json({
            message: 'post deleted'
        });

    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};
const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => {
        console.log(err);
    });
}