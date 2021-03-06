const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");
const Op = models.Sequelize.Op;

import models from "../setup/models";
// const User = require("../models/user");
// const Image = require("../models/image");
// const Comment = require("../models/postComment");
// const Avatar = require("../models/avatar");
// const PostRate = require("../models/postRate");
const rewardPost = 20;
const rewardComment = 1;

module.exports = {
  /*
   * Get posts by user
   */
  getPosts: async (req, res, next) => {
    //currentPage is one only if undefined "null not included"
    let { currentPage = 1, pageSize = 4 } = req.query;

    // Make sure these are numbers
    currentPage = parseInt(currentPage);
    currentPage == 1 ? (currentPage = 0) : (currentPage = currentPage - 1);
    pageSize = parseInt(pageSize);

    //offset = currentPage(7) * pageSize(25) = 175
    //limit = pageSize(25)
    const offset = currentPage * pageSize;
    const limit = pageSize;

    try {
      const { count, rows: posts } = await models.Post.findAndCountAll({
        limit,
        offset,
        // todo order
        //order: [["createdAt", "ASC"]],
        where: {
          userId: req.user.id
        },
        include: [
          {
            model: models.Image,
            attributes: ["imageRef"]
          },
          {
            model: models.User,
            attributes: ["username"],
            include: [
              {
                model: models.Avatar,
                attributes: ["imageRef"]
              }
            ]
          }
        ],
        order: [["title", "ASC"]]
      });
      if (posts.length > 0) {
        return res.status(200).json({
          message: "Posts found!",
          posts: posts,
          currentPage: currentPage + 1,
          count: count / pageSize
        });
      } else {
        return res.status(200).json({
          message: "No posts found!"
        });
      }
    } catch (error) {
      console.log(error);
    }
  },

  /*
   * Create a new comment for exesting post
   */
  addComment: (req, res, next) => {
    const errors = validationResult(req);
    const postId = req.params.postId;
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed, entered data is incorrect.");
      error.statusCode = 422;
      throw error;
    }
    models.User.findByPk(req.user.id, {
      include: [
        {
          model: models.Avatar,
          attributes: ["imageRef"]
        }
      ]
    })
      .then(user => {
        if (user.Avatars) {
          user.update({ credit: user.credit + rewardComment });
          return models.PostComment.create({
            text: req.body.text,
            imageRef: user.Avatars.imageRef,
            userId: req.user.id,
            postId: postId
          });
        } else {
          return models.PostComment.create({
            text: req.body.text,
            imageRef: "",
            userId: req.user.id,
            postId: postId
          });
        }
      })
      .then(comment => {
        return models.PostComment.findByPk(comment.id, {
          include: [
            {
              model: models.User,
              attributes: ["username"]
            }
          ]
        }).then(comment => {
          res.status(201).json({
            message: "Comment created successfully!",
            comment: comment
          });
        });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  },

  /*
   * Add rating to exesting post
   */
  addRate: async (req, res, next) => {
    const errors = await validationResult(req);
    const postId = req.params.postId;
    const rate = req.params.postRate;
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed, entered data is incorrect.");
      error.statusCode = 422;
      throw error;
    }
    // postId = Post.findByPk(postId).then(post => {
    //   return post.id;
    // });
    models.PostRate.findOne({
      where: {
        postId: postId,
        userId: req.user.id
      }
    })
      .then(postRate => {
        if (postRate) {
          postRate.update({
            rate: rate
          });
        } else {
          models.PostRate.create({
            postId: postId,
            userId: req.user.id,
            rate: rate
          });
        }
      })
      .then(res => {
        //Add award to user after rating
        req.user.update({ credit: req.user.credit + rewardComment });
        return models.Post.findByPk(postId);
      })
      .then(post => {
        res.status(201).json({
          message: "Rate added successfully!",
          rate: post.starCount
        });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  },

  /*
   * Create new post
   */
  createPost: async (req, res, next) => {
    const location = JSON.parse(req.body.location);
    const addressArray = location.address.split(",");
    const address = await models.Address.create({
      street: addressArray[0],
      city: addressArray[1],
      country: addressArray[2],
      lat: location.coordinates.lat,
      lang: location.coordinates.lng,
      postcode: 0
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed, entered data is incorrect.");
      error.statusCode = 422;
      throw error;
    }
    if (!req.files[0] || !req.user) {
      const error = new Error("No image provided or user not registred");
      error.statusCode = 422;
      throw error;
    }
    const title = req.body.title;
    const content = req.body.content;
    let credit = 0;
    return models.User.findByPk(req.user.id)
      .then(user => {
        if (!user) {
          const error = new Error("User not found.");
          error.statusCode = 404;
          throw error;
        }
        ///Add reward to user after posting
        credit = user.credit + rewardPost;
        user.update({ credit: user.credit + rewardPost });
        return models.Post.create({
          title: title,
          content: content,
          category: req.body.category,
          userId: user.id,
          author: user.username,
          imageUrl: req.files[0].path
        })
          .then(post => {
            /**
             *
             */
            post.setAddress(address);
            
            req.files.map(file => {
              models.Image.create({
                imageRef: file.path
              }).then(image => {
                image.setPost(post);
              });
            });
            return post;
            // ,
            // Post.update({
            //   imageUrl: req.files[0].path
            // }, {
            //   where: {
            //     id: post.id
            //   }
            // })
          })
          .then(post => {
            res.status(201).json({
              message: "Post created successfully!",
              post: post,
              userId: req.user.id,
              credit: credit
            });
          });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  },
  /*
   * Get one post by id
   */
  getPost: (req, res, next) => {
    models.Post.findByPk(req.params.postId, {
      include: [
        {
          model: models.Image,
          attributes: ["imageRef"]
        },
        {
          model: models.Address,
          attributes: ["city", "country", "lang", "lat"]
        },
        {
          model: models.User,
          attributes: ["username"],
          include: [
            {
              model: models.Avatar,
              attributes: ["imageRef"]
            }
          ]
        },
        {
          model: models.PostComment,
          include: [
            {
              model: models.User,
              attributes: ["username"]
            }
          ]
        }
      ]
    })
      .then(post => {
        if (!post) {
          const error = new Error("Could not find post.");
          error.statusCode = 404;
          throw error;
        }
        res.status(200).json({
          message: "Post fetched.",
          post: post
        });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  },
  // todo fix get top for each category
  /**
   * Get Top noted feeds for home
   */
  getTopFeed: (req, res, next) => {
    // var t5 = mydata.slice(0,5);
    models.Post.findAll({
      limit: 4,
      include: [
        {
          model: models.Image,
          attributes: ["imageRef"]
        },
        {
          model: models.User,
          attributes: ["username"],
          include: [
            {
              model: models.Avatar,
              attributes: ["imageRef"]
            }
          ]
        }
      ]
    })
      .then(posts => {
        res.status(200).json({
          message: "Fetched top posts successfully.",
          posts: posts
        });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  },
  //todo fix get top 4 of selected category
  /**
   * Get Top noted feeds by category
   */
  getTopSearchFeed: (req, res, next) => {
    // var t5 = mydata.slice(0,5);
    models.Post.findAll({
      limit: 4,
      include: [
        {
          model: models.Image,
          attributes: ["imageRef"]
        },
        {
          model: models.User,
          attributes: ["username"],
          include: [
            {
              model: models.Avatar,
              attributes: ["imageRef"]
            }
          ]
        }
      ]
    })
      .then(posts => {
        res.status(200).json({
          message: "Fetched top posts successfully.",
          posts: posts
        });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  },
  /*
   * update exesting post
   */
  updatePost: (req, res, next) => {
    const postId = req.params.postId;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed, entered data is incorrect.");
      error.statusCode = 422;
      throw error;
    }
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;
    if (req.file) {
      imageUrl = req.file.path;
    }
    if (!imageUrl) {
      const error = new Error("No file picked.");
      error.statusCode = 422;
      throw error;
    }
    models.Post.findByPk(postId)
      .then(post => {
        if (!post) {
          const error = new Error("Could not find post.");
          error.statusCode = 404;
          throw error;
        }
        if (post.creator.toString() !== req.user.id) {
          const error = new Error("Not authorized!");
          error.statusCode = 403;
          throw error;
        }
        if (imageUrl !== post.imageUrl) {
          clearImage(post.imageUrl);
        }
        post.title = title;
        post.imageUrl = imageUrl;
        post.content = content;
        return post.save();
      })
      .then(result => {
        res.status(200).json({
          message: "Post updated!",
          post: result
        });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  },
  deletePost: (req, res, next) => {
    const postId = req.params.postId;
    models.Post.findByPk(postId)
      .then(post => {
        if (!post) {
          const error = new Error("Could not find post.");
          error.statusCode = 404;
          throw error;
        }
        if (post.creator.toString() !== req.user.id) {
          const error = new Error("Not authorized!");
          error.statusCode = 403;
          throw error;
        }
        // Check logged in user
        clearImage(post.imageUrl);
        return Post.findByIdAndRemove(postId);
      })
      .then(result => {
        return User.findById(req.user.id);
      })
      .then(user => {
        user.posts.pull(postId);
        return user.save();
      })
      .then(result => {
        res.status(200).json({
          message: "Deleted post."
        });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  },

  clearImage: filePath => {
    filePath = path.join(__dirname, "..", filePath);
    fs.unlink(filePath, err => console.log(err));
  },

  /**
   * Search for post
   */
  searchPost: async (req, res) => {
    //currentPage is one only if undefined "null not included"
    let { term, category, city, currentPage = 1, pageSize = 2 } = req.query;

    // Make sure these are numbers
    currentPage = parseInt(currentPage);
    currentPage == 1 ? (currentPage = 0) : (currentPage = currentPage - 1);
    pageSize = parseInt(pageSize);
    // Make lowercase
    term ? (term = term.toLowerCase()) : "";
    //offset = currentPage(7) * pageSize(25) = 175
    //limit = pageSize(25)
    const offset = currentPage * pageSize;
    const limit = pageSize;

    try {
      const { count, rows: posts } = await models.Post.findAndCountAll({
        limit,
        offset,
        // todo order
        //order: [["createdAt", "ASC"]],
        where: {
          title: { [Op.like]: "%" + term + "%" },
          category: { [Op.like]: "%" + category + "%" }
        },
        include: [
          {
            model: models.Address,
            where: {
              city: { [Op.like]: "%" + city + "%" }
            }
          },
          {
            model: models.Image,
            attributes: ["imageRef"]
          },
          {
            model: models.User,
            attributes: ["username"],
            include: [
              {
                model: models.Avatar,
                attributes: ["imageRef"]
              }
            ]
          }
        ],
        order: [["title", "ASC"]]
      });
      if (posts.length > 0) {
        return res.status(200).json({
          message: "Posts found!",
          post: posts,
          currentPage: currentPage + 1,
          count: count / 2
        });
      } else {
        return res.status(200).json({
          message: "Sorry change search term!"
        });
      }
    } catch (error) {
      console.log(error);
    }
  }
};
// module.exports = {
//     method: function() {},
//     otherMethod: function() {}
// }
