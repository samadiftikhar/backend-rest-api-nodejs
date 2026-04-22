const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.get('Authorization');
    if (!authHeader) {
        const error = new Error('Not authenticated.');
        error.statusCode = 401;
        throw error;
    }
    const token = req.get('Authorization').split(' ')[1];
    let decodedToken;
    try {
        decodedToken = jwt.verify(token, 'somesupersecretsecret');
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            err.statusCode = 401;
            err.message = 'Token expired';
        } else if (err.name === 'JsonWebTokenError') {
            err.statusCode = 401;
            err.message = 'Invalid token';
        } else {
            err.statusCode = 500;
        }

        throw err;
    }
    if (!decodedToken) {
        const error = new Error('Not authenticated.');
        error.statusCode = 401;
        throw error;
    }
    req.userId = decodedToken.userId;
    next();

}

