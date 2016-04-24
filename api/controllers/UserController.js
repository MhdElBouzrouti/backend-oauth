/**
 * UserController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var request = require('request');
module.exports = {
  login: function (req, res) {
    var accessTokenUrl = 'https://api.orange.com/openidconnect/fr/v1/token';
    var userInfoUrl = 'https://api.orange.com/openidconnect/v1/userinfo';
    // Params For Access Token
    var params = {
      code: req.allParams().code,
      client_id: config.CLIENT_ID,
      client_secret: config.ORANGE_SECRET,
      redirect_uri: config.REDIRECT_URI,
      grant_type: 'authorization_code'
    };
    sails.log.debug(params);
    var headers={'Authorization':config.AUTHORIZATION_HEADER};
    var body='grant_type=authorization_code&redirect_uri='+params.redirect_uri+'&code='+params.code;

    // Step 1. Exchange authorization code for access token.
    request({url:accessTokenUrl,method:'post',headers:headers,form:body}, function(err, response, token) {
      if(err)
        sails.log.debug(err);
      sails.log.debug(response);
      var accessToken = JSON.parse(response.body).access_token;
      sails.log.debug(response.body);
      sails.log.debug(accessToken);
      var headers = { Authorization: 'Bearer ' + accessToken };

      // Step 2. Retrieve profile information about the current user.
      request.get({ url: userInfoUrl, headers: headers, json: true }, function(err, response, profile) {
        sails.log.debug(response);
        if (profile.error) {
          return res.status(500).send({message: profile.error.message});
        }
        // Step 3a. Link user accounts.
        if (req.header('Authorization')) {
          User.findOne({ google: profile.sub }, function(err, existingUser) {
            if (existingUser) {
              return res.status(409).send({ message: 'There is already a Google account that belongs to you' });
            }
            var token = req.header('Authorization').split(' ')[1];
            var payload = jwt.decode(token, config.TOKEN_SECRET);
            User.findById(payload.sub, function(err, user) {
              if (!user) {
                return res.status(400).send({ message: 'User not found' });
              }
              user.google = profile.sub;
              user.picture = user.picture || profile.picture.replace('sz=50', 'sz=200');
              user.displayName = user.displayName || profile.name;
              user.save(function() {
                var token = createJWT(user);
                res.send({ token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          User.findOne({ google: profile.sub }, function(err, existingUser) {
            if (existingUser) {
              return res.send({ token: createJWT(existingUser) });
            }
            var user = new User();
            user.google = profile.sub;
            user.picture = profile.picture.replace('sz=50', 'sz=200');
            user.displayName = profile.name;
            user.save(function(err) {
              var token = createJWT(user);
              res.send({ token: token });
            });
          });
        }
      });
    });
  }

};

