// import AWS from 'aws-sdk';
const AWS = require('aws-sdk');
// import { nanoid } from 'nanoid';
const { nanoid } = require('nanoid');
// import Scene from '../models/scene';
const Scene = require('../models/scene');
const Board = require('../models/board');
// import slugify from 'slugify';
const slugify = require('slugify');
// import { readFileSync } from 'fs'; // fs.readFileSync
const { readFileSync } = require('fs');
// import Field from '../models/field';
const Field = require('../models/field');
const Shot = require('../models/shot');

const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
};

const S3 = new AWS.S3(awsConfig);

exports.uploadImage = async (req, res) => {
  // console.log(req.body)
  try {
    const { image } = req.body;
    if (!image) return res.status(400).send('No Image');

    // prepare image for upload
    const base64Data = new Buffer.from(
      image.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );

    const type = image.split(';')[0].split('/')[1];

    // image params
    const params = {
      Bucket: 'dreamfields-bucket',
      Key: `${nanoid()}.${type}`,
      Body: base64Data,
      ACL: 'public-read',
      ContentEncoding: 'base64',
      ContentType: `image/${type}`,
    };
    // upload to s3
    S3.upload(params, (err, data) => {
      if (err) {
        console.log(err);
        return res.sendStatus(400);
      }
      console.log(data);
      res.send(data);
    });
  } catch (err) {}
};

exports.removeImage = async (req, res) => {
  try {
    const { image } = req.body;
    console.log(image);
    // image params for s3
    const params = {
      Bucket: image.Bucket,
      Key: image.Key,
    };

    // send remove request to s3
    S3.deleteObject(params, (err, data) => {
      if (err) {
        console.log(err);
        res.sendStatus(400);
      }
      res.send({ ok: true });
    });
  } catch (err) {
    console.log(err);
  }
};

exports.create = async (req, res) => {
  // console.log('CREATE SCENE', req.body);

  // return;
  try {
    // const alreadyExists = await Scene.findOne({
    //   slug: slugify(req.body.name.toLowerCase()),
    // });

    // if (alreadyExists) return res.status(400).send('Scene aleady exists');

    const scene = await new Scene({
      slug: slugify(req.body.sceneName),
      creator: req.user._id,
      ...req.body,
    }).save();

    // { $push: { friends: friend } }
    // find field and update with new scene
    const field = await Field.findOneAndUpdate(
      { _id: scene.forProject },
      { $push: { scenes: [scene._id] } },
      { new: true }
    ).exec(
      // error handler
      (err) => {
        if (err) {
          console.log(err);
          return res
            .status(400)
            .send('Error while updating field with new scene');
        }
      }
    );

    console.log('field updated', field);
    const scenes = await Scene.find({ forProject: scene.forProject }).exec();

    // Link.findOneAndUpdate({ _id: id }, updatedLink, { new: true }).exec(
    //   (err, updated) => {
    //     if (err) {
    //       return res.status(400).json({
    //         error: 'Error updating link',
    //       });
    //     }
    //     res.json(updated);
    //   }
    // );

    // console.log('SCENE SAVED', scene)
    const newScene = scene;
    res.json({scenes, newScene});
    console.log('RESPONSE SENT');
  } catch (err) {
    console.log(err);
    return res.status(400).send('Error creating scene. Check log.');
  }
};

exports.read = async (req, res) => {
  // console.log('REQ PARAMS',req.params.sceneId)
  // return
  try {
    const scene = await Scene.findOne({ _id: req.params.sceneId }).exec();
    // .populate('creator', '_id name')
    res.json(scene);
  } catch (err) {
    console.log('ERROR reading scene', err);
  }
};

exports.deleteScene = async (req, res) => {
  console.log('DELETE SCENE', req.params.sceneId, req.params.fieldId);
  const fieldId = req.params.fieldId;

  try {

    const sceneObjectId = await Field.findOneAndUpdate(
      { _id: fieldId },
      { $pull: { scenes: req.params.sceneId } }
    ).exec(
    //   (err, updatedField) => {
    //   if (err) {
    //     console.log(err);
    //     return res.status(400).send('Error while updating field');
    //   }
    //   // console.log('field updated', updatedField);
    //   // res.sendStatus(200);
    // }
    );

    const scene = await Scene.findOneAndRemove({
      _id: req.params.sceneId,
    }).exec();

    // find and remove shots
    const shots = await Shot.find({ forScene: req.params.sceneId }).exec();
    shots.forEach((shot) => {
      Shot.findOneAndRemove({ _id: shot._id }).exec();
    });

    // find and remove boards
    const boards = await Board.find({ forScene: req.params.sceneId }).exec();
    boards.forEach((board) => {
      Board.findOneAndRemove({ _id: board._id }).exec();
    });

    const scenes = await Scene.find({forProject: fieldId})

    console.log('SCENES AFTER DELETE: ', scenes)
    res.json(scenes);
  } catch (err) {
    console.log('ERROR deleting scene', err);
  }
};

exports.uploadVideo = async (req, res) => {
  // console.log('UPLOAD VIDEO REQ USER ID', req.user._id);
  // console.log('UPLOAD VIDEO PARAMS', req.params.creatorId);
  // match user id with contributor id or creator id
  // if (req.user._id != req.params.creatorId) {
  //   return res.status(400).send('Unauthorized');
  // }

  // find scene from schema
  const scene = await Scene.findOne({
    _id: req.params.sceneId,
  });

  // TODO: make isContributor work
  // const isContributor = JSON.parse(contributors).some((contributor) => {
  //   return req.user._id != contributor ? false : true;
  // });

  // if (!isCreator && !isContributor) {
  //   return res.status(400).send('Unauthorized');
  // }

  // if (!isContributor) return res.status(400).send('Unauthorized');
  const isCreator = req.user._id == req.params.creatorId; // add this in if statement after testing

  try {
    const { video } = req.files;
    // console.log(video)
    !video && res.status(400).send('No video');

    const params = {
      Bucket: 'dreamfields-bucket',
      Key: `${nanoid()}.${video.type.split('/')[1]}`, // this code retruns an array by splitting the video file name like file/mov to ['file', 'mov'] then we take the second (which is index 1) and we use it to make the code with a random string from nanoid with mp4
      Body: readFileSync(video.path),
      ACL: 'public-read',
      ContentType: video.type,
    };

    // upload to s3
    S3.upload(params, (err, data) => {
      if (err) {
        console.log(err);
        res.sendStatus(400);
      }
      console.log(data);
      res.send(data);
    });

    const scene = await Scene.findOne({ _id: req._id });
  } catch (error) {
    console.log(error);
  }
};

exports.removeVideo = async (req, res) => {
  if (req.user._id != req.params.creatorId) {
    return res.status(400).send('Unauthorized');
  }
  console.log('REQ BODY VIDEO REMOVE', req.body);
  try {
    const video = req.body;
    !video && res.status(400).send('No video');

    const params = {
      Bucket: video.Bucket,
      Key: video.Key,
    };

    // delete to s3
    S3.deleteObject(params, (err, data) => {
      if (err) {
        console.log(err);
        res.sendStatus(400);
      }
      console.log(data);
      res.json({ ok: true });
    });
  } catch (error) {
    console.log(error);
  }
};

exports.update = async (req, res) => {
  // console.log('UPDATE SCENE', req.body);
  const itemUpdate = req.body;
  // return;
  try {
    const scene = await Scene.findOneAndUpdate(
      { _id: req.params.sceneId },
      itemUpdate,
      { new: true }
    ).exec();

    res.json(scene);
  } catch (error) {
    console.log(error);
  }
};

exports.saveVideo = async (req, res) => {
  console.log('UPDATE VIDEO', req.body);
  // return
  let itemUpdate = req.body;
  itemUpdate.sceneId = req.params.sceneId;
  // return;
  try {
    const scene = await Scene.findOneAndUpdate(
      { _id: req.params.sceneId },
      { $push: { videos: [itemUpdate] } },
      { new: true }
    ).exec();
    console.log('PUSHED VIDEO', scene);
    res.json(scene);
  } catch (error) {
    console.log(error);
  }
};

exports.updateVideo = async (req, res) => {
  console.log('UPDATE VIDEO', req.body);
  // return
  let itemUpdate = req.body;
  itemUpdate.sceneId = req.params.sceneId;
  // return;
  try {
    const scene = await Scene.findOneAndUpdate(
      { _id: req.params.sceneId, 'videos.videoKey': itemUpdate.videoData.Key },
      { $set: { 'videos.$': itemUpdate } },
      { new: true }
    ).exec();
    console.log('PUSHED VIDEO', scene);
    res.json(scene);
  } catch (error) {
    console.log(error);
  }
};

exports.updateArray = async (req, res) => {
  // { arrayName: [ 'characters' ], itemName: 'boob' }
  // console.log('UPDATE SCENE', req.body);
  // return
  const { arrayName, itemName } = req.body;
  // return;
  try {
    const scene = await Scene.findOneAndUpdate(
      { _id: req.params.sceneId },
      { [arrayName]: itemName },
      { new: true }
    ).exec();

    res.json(scene);
  } catch (error) {
    console.log(error);
  }
};
exports.updatePushArrayItem = async (req, res) => {
  // { arrayName: [ 'characters' ], itemName: 'boob' }
  // console.log('UPDATE SCENE', req.body);
  // return
  const { arrayName, itemName } = req.body;
  // return;
  try {
    const scene = await Scene.findOneAndUpdate(
      { _id: req.params.sceneId },
      { $push: { [arrayName]: [itemName] } },
      { new: true }
    ).exec();

    res.json(scene);
  } catch (error) {
    console.log(error);
  }
};

exports.createShot = async (req, res) => {
  try {
    // const user = await User.findOne({ name: 'Joe' });
    // const field = await Field.findOne({ name: user.name });
    // const scene = await Scene.findOne({ sceneName: 'test' });
    const shotData = req.body;

    // const {shotQuery} = query.body
    // const shotQuery = {
    //   shot: 'test shot',
    //   forScene: scene._id,
    //   complexity: 'Medium',
    // };

    /**
     * Create a shot
     */
    const shot = await new Shot(shotData);
    await shot.save();

    /**
     * Save shot to scene
     */
    const updatedScene = await Scene.findById(shotData.forScene);
    await updatedScene.shotList.push({
      shotId: shot._id,
      shotName: shot.shotName,
      shotNumber: shot.shotNumber,
    });
    await updatedScene.save();
    console.log('SHOT CREATED: ', shot);
    console.log('UPDATED SCENE: ', updatedScene);
    res.json(shot);
  } catch (error) {
    console.log(error);
    return res.status(400).send('Error creating shot');
  }
};

exports.readShots = async (req, res) => {
  try {
    // const scene = await Scene.findById(req.params.sceneId);
    // res.json(scene.shotList);
    const shots = await Shot.find({ forScene: req.params.sceneId });
    // await console.log('SHOTS REQUESTED: ', shots);
    res.json(shots);
  } catch (error) {
    console.log(error);
  }
};

// update shot
exports.updateShot = async (req, res) => {
  try {
    const shot = await Shot.findById(req.params.shotId);
    await shot.update(req.body);
    res.json(shot);
  } catch (error) {
    console.log(error);
  }
};

exports.creatorUpdateShot = async (req, res) => {
  try {
    const shot = await Shot.findByIdAndUpdate(req.params.shotId, req.body);
    // await shot.update(shotUpdate);
    // res.json(shot);
    console.log('SHOT UPDATE: ', shot);
    const updatedShots = await Shot.find({ forScene: req.params.sceneId });

    // const shot = await Shot.findById(req.params.shotId);
    // await shot.update(req.body);
    res.json(updatedShots);
  } catch (error) {
    console.log(error);
  }
};

exports.creatorUpdateShotArray = async (req, res) => {
  const { arrayName, itemName } = req.body;
  try {
    const shot = await Shot.findByIdAndUpdate(
      req.params.shotId,
      { [arrayName]: itemName } ,
      { new: true }
    ).exec();
    // await shot.update(shotUpdate);
    // res.json(shot);
    console.log('SHOT UPDATE: ', shot);

    const updatedShots = await Shot.find({ forScene: req.params.sceneId });

    // const shot = await Shot.findById(req.params.shotId);
    // await shot.update(req.body);
    res.json(updatedShots);
  } catch (error) {
    console.log(error);
  }
};

// delete shot
exports.deleteShot = async (req, res) => {
  try {
    // const scene = await Scene.findOne({ _id: req.params.sceneId });
    // const shot = await Shot.findOne({ _id: req.params.shotId });
    const shot = await Shot.findByIdAndRemove(req.params.shotId);

    const updatedScene = await Scene.findByIdAndUpdate(
      req.params.sceneId,
      { $pull: { shotList: { shotId: shot._id } } },
      { new: true }
    );

    console.log('DELETED: SHOT NAME: ', shot);
    console.log('DELETED: UPDATED SCENE: ', updatedScene);
    res.json(shot);
  } catch (error) {
    console.log(error);
  }
};
