const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const journal = require('../modules/logger');
const throwError = require('../errors/throw-error');
const { routes } = require('../config');

const {
  tokenKey, refreshTokenKey, algorithm, tokenLiveTimeMs,
} = require('./constants');
const repository = require('../users/repository');

const loginUser = async (email, password) => {
  try {
    if (!email) {
      throwError(`Authorize email is ${email}`, 401);
    }

    if (!password) {
      throwError(`Authorize password is ${password}`, 401);
    }

    const user = await repository.getUserByEmail(email);

    if (!user) {
      throwError('User not found', 404);
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throwError('Wrong password', 401);
    }

    const token = jwt.sign({
      id: user.id,
      date: Date.now(),
      typ: 'JWT',
      sub: 'auth',
    }, tokenKey, { algorithm });

    const refreshToken = jwt.sign({
      id: user.id,
    }, refreshTokenKey, { algorithm });

    return {
      id: user.id,
      token,
      refreshToken,
    };
  } catch (error) {
    throw error;
  }
};

const logoutUser = async (token, refreshToken) => {
  try {
    if (!token) {
      throwError('Token is not specified', 400);
    }

    await repository.logoutUser(token, refreshToken);
  } catch (error) {
    throw error;
  }
};

const checkUser = (req, res, next) => {
  if (req.headers.authorization) {
    jwt.verify(req.headers.authorization.split(' ')[1],
      tokenKey, { algorithms: [algorithm] }, async (err, payload) => {
        if (err) {
          journal.auth.error(`CHECK USER TOKEN ${req.headers.authorization}`);
          next({ code: 401, message: 'Invalid token' });
          return;
        }

        if (payload && !payload.id) {
          journal.auth.error('TOKEN IS NOT CONTAIN USER ID');
          next({ code: 401, message: 'Invalid token' });
          return;
        }

        if (payload.date + tokenLiveTimeMs < Date.now()) {
          journal.auth.error('TOKEN IS DEAD');
          next({ code: 401, message: 'Token is dead' });
          return;
        }

        try {
          const user = await repository.getUserById(payload.id);

          if (!user) {
            throwError(`User with id ${payload.id} is not exist`, 404);
          }

          next();
        } catch (error) {
          journal.auth.error(`CHECK USER TOKEN ${error}`);
          next(error);
        }
      });
  } else if ((req.url === routes.users.main && req.method === 'POST')
    || req.url === routes.authorize.login) {
    next();
  } else {
    next({ code: 401, message: 'Invalid token' });
  }
};

module.exports = {
  loginUser,
  logoutUser,
  checkUser,
};
