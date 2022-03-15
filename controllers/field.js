// import AWS from 'aws-sdk';
const AWS = require('aws-sdk');
// import { nanoid } from 'nanoid';
const {nanoid} = require('nanoid')
// import Field from '../models/field';
const Field = require('../models/field');
// import Scene from '../models/scene';
const Scene = require('../models/scene');
// import slugify from 'slugify';
const slugify = require('slugify');
// import { readFileSync } from 'fs'; // fs.readFileSync
const {readFileSync} = require('fs')
// fs.readFileSync}

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
  console.log('CREATE FIELD', req.body);
  // return
  try {
    const alreadyExists = await Field.findOne({
      slug: slugify(req.body.name.toLowerCase()),
    });
    if (alreadyExists) return res.status(400).send('Field is taken');

    const field = await new Field({
      slug: slugify(req.body.name),
      creator: req.user._id,
      ...req.body,
    }).save();
    res.json(field);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Field creation failed. Try again.');
  }
};

exports.deleteField = async (req, res) => {
  try {
    const field = await Field.findByIdAndDelete(req.params.fieldId);
    // TODO: delete all scenes
    // const scenes = await Scene.find({ forProject: field.slug });
    // scenes.forEach(async (scene) => {
    //   await scene.remove();
    // });
    const fields = await Field.find({creator: req.user._id})

    const returnField = await fields[0] ? fields[0] : {}
    
    // const shots = await Shot.find({ forProject: field.slug });
    // shots.forEach(async (shot) => {
    //   await shot.remove();
    // });
    // TODO: delete all shots
    res.json(returnField);
  } catch (err) {
    console.log(err);
  }
}

exports.updateFieldItem = async (req, res) => {
  console.log('FIELD UPDATE OBJECT: ',req.body)
  const itemObject = req.body;
  try {
    const field = await Field.findByIdAndUpdate(
      req.params.fieldId ,
      { $set: itemObject },
      { new: true }
    );
    res.json(field);
  } catch (err) {
    console.log(err);
  }
}

exports.read = async (req, res) => {
  try {
    console.log('GET FIELD')
    const field = await Field.findOne({ slug: req.params.slug })
      // .populate('creator', '_id name')
      .exec();
    res.json(field);
  } catch (err) {}
};

exports.getScenes = async (req, res) => {
  try {
    const scenes = await Scene.find({ forProject: req.params.fieldSlug })
      .populate('creator', '_id name')
      .exec();
    res.json(scenes);
  } catch (err) {
    console.log(err);
  }
};

exports.removeScript = async () => {
  //
};

exports.uploadScript = async (req, res) => {
  console.log('script', req.files);
  try {
    const { script } = req.files;

    !script && res.status(400).send('No Script');

    const params = {
      Bucket: 'dreamfields-bucket',
      Key: `${nanoid()}.${script.type.split('/')[1]}`,
      Body: readFileSync(script.path),
      ACL: 'public-read',
      ContentType: script.type,
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
  } catch (err) {
    console.log(err);
  }
};

exports.uploadVideo = async (req, res) => {
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
  } catch (error) {
    console.log(error);
  }
};

// uploadScript,
//   removeScript,
