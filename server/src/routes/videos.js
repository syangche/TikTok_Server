const express = require('express');
const videoController = require('../controllers/videoController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', videoController.getAllVideos);
router.get('/:id', videoController.getVideoById);
router.get('/:id/comments', videoController.getVideoComments);

// Protected routes
router.post('/', protect, videoController.createVideo);
router.put('/:id', protect, videoController.updateVideo);
router.delete('/:id', protect, videoController.deleteVideo);

// Like/unlike video
router.post('/:id/like', protect, videoController.toggleVideoLike);
router.delete('/:id/like', protect, videoController.toggleVideoLike);

module.exports = router;