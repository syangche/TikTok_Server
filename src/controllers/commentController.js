const prisma = require('../lib/prisma');

// Get all comments
exports.getAllComments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    const comments = await prisma.comment.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        },
        video: {
          select: {
            id: true,
            caption: true,
            thumbnailUrl: true
          }
        },
        _count: {
          select: { likes: true }
        }
      }
    });
    
    // Get total count for pagination
    const totalComments = await prisma.comment.count();
    
    res.status(200).json({
      comments,
      totalPages: Math.ceil(totalComments / take),
      currentPage: parseInt(page),
      totalComments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
};

// Get comment by ID
exports.getCommentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        },
        video: {
          select: {
            id: true,
            caption: true,
            thumbnailUrl: true
          }
        },
        _count: {
          select: { likes: true }
        }
      }
    });
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // If user is logged in, check if they've liked the comment
    if (req.user) {
      const userId = req.user.id;
      
      const like = await prisma.commentLike.findUnique({
        where: {
          userId_commentId: {
            userId: parseInt(userId),
            commentId: parseInt(id)
          }
        }
      });
      
      comment.isLiked = !!like;
    }
    
    res.status(200).json(comment);
  } catch (error) {
    console.error(`Error fetching comment ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch comment' });
  }
};

// Create comment
exports.createComment = async (req, res) => {
  try {
    const { videoId, content } = req.body;
    const userId = req.user.id;
    
    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: parseInt(videoId) }
    });
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        userId: parseInt(userId),
        videoId: parseInt(videoId)
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        }
      }
    });
    
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Failed to create comment' });
  }
};

// Update comment
exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    // Check if comment exists and belongs to user
    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    if (comment.userId !== parseInt(userId)) {
      return res.status(403).json({ message: 'Not authorized to update this comment' });
    }
    
    // Update comment
    const updatedComment = await prisma.comment.update({
      where: { id: parseInt(id) },
      data: {
        content,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        }
      }
    });
    
    res.status(200).json(updatedComment);
  } catch (error) {
    console.error(`Error updating comment ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to update comment' });
  }
};

// Delete comment
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(id) },
      include: {
        video: {
          select: { userId: true }
        }
      }
    });
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is authorized to delete (comment owner or video owner)
    if (comment.userId !== parseInt(userId) && comment.video.userId !== parseInt(userId)) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    // Delete comment
    await prisma.comment.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error(`Error deleting comment ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
};

// Like/unlike comment
exports.toggleCommentLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if like already exists
    const existingLike = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: {
          userId: parseInt(userId),
          commentId: parseInt(id)
        }
      }
    });
    
    let action;
    
    if (existingLike) {
      // Unlike - delete the like
      await prisma.commentLike.delete({
        where: {
          userId_commentId: {
            userId: parseInt(userId),
            commentId: parseInt(id)
          }
        }
      });
      action = 'unliked';
    } else {
      // Like - create a like
      await prisma.commentLike.create({
        data: {
          userId: parseInt(userId),
          commentId: parseInt(id)
        }
      });
      action = 'liked';
    }
    
    // Get updated like count
    const likeCount = await prisma.commentLike.count({
      where: { commentId: parseInt(id) }
    });
    
    res.status(200).json({
      message: `Comment ${action} successfully`,
      action,
      likeCount
    });
  } catch (error) {
    console.error(`Error toggling like for comment ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to toggle like' });
  }
};

module.exports = {
  getAllComments: exports.getAllComments,
  getCommentById: exports.getCommentById,
  createComment: exports.createComment,
  updateComment: exports.updateComment,
  deleteComment: exports.deleteComment,
  toggleCommentLike: exports.toggleCommentLike
};