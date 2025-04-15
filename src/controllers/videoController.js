const prisma = require('../lib/prisma');

// Get all videos
exports.getAllVideos = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const limitNum = parseInt(limit) || 10;
    
    // Build the query based on the cursor
    const queryOptions = {
      take: limitNum + 1, // Take one extra to determine if there are more items
      orderBy: {
        createdAt: 'desc', // Most recent videos first
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true
          }
        }
      }
    };
    
    // If cursor is provided, filter records after the cursor
    if (cursor) {
      queryOptions.cursor = {
        id: parseInt(cursor),
      };
      queryOptions.skip = 1; // Skip the cursor itself
    }
    
    // Fetch videos
    const videos = await prisma.video.findMany(queryOptions);
    
    // Check if there are more items
    const hasNextPage = videos.length > limitNum;
    
    // Remove the extra item we used to check for more data
    if (hasNextPage) {
      videos.pop();
    }
    
    // If user is logged in, check if they've liked the videos
    if (req.user) {
      const userId = req.user.id;
      const videoIds = videos.map(video => video.id);
      
      const userLikes = await prisma.videoLike.findMany({
        where: {
          userId: parseInt(userId),
          videoId: {
            in: videoIds
          }
        }
      });
      
      // Add isLiked property to videos
      videos.forEach(video => {
        video.isLiked = userLikes.some(like => like.videoId === video.id);
      });
    }
    
    // Format videos with count data
    const formattedVideos = videos.map(video => ({
      ...video,
      likeCount: video._count.likes,
      commentCount: video._count.comments,
      _count: undefined,
    }));
    
    // Get the next cursor from the last item
    const nextCursor = hasNextPage ? formattedVideos[formattedVideos.length - 1].id.toString() : null;
    
    // Return videos with pagination metadata
    res.status(200).json({
      videos: formattedVideos,
      pagination: {
        nextCursor,
        hasNextPage,
      },
    });
  } catch (error) {
    console.error('Error getting videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get video by ID
exports.getVideoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid video ID' });
    }
    
    const videoId = parseInt(id);
    
    // Increment views
    await prisma.video.update({
      where: { id: videoId },
      data: {
        views: {
          increment: 1
        }
      }
    });
    
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true
          }
        }
      }
    });
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Check if user has liked the video
    if (req.user) {
      const userId = req.user.id;
      
      const like = await prisma.videoLike.findUnique({
        where: {
          userId_videoId: {
            userId: parseInt(userId),
            videoId: parseInt(id)
          }
        }
      });
      
      video.isLiked = !!like;
    }
    
    res.status(200).json(video);
  } catch (error) {
    console.error(`Error fetching video ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch video' });
  }
};

exports.getUserVideos = async (req, res) => {
  try {
    // Remove the query params - just get all videos for the user
    const response = await apiClient.get(`/users/${userId}/videos`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching videos for user ${userId}:`, error);
    throw error;
  }
};

// Get videos by user
// exports.getUserVideos = async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     // Check if user exists
//     const userExists = await prisma.user.findUnique({
//       where: { id: parseInt(id) },
//     });
    
//     if (!userExists) {
//       return res.status(404).json({ message: 'User not found' });
//     }
    
//     // Get user's videos
//     const videos = await prisma.video.findMany({
//       where: {
//         userId: parseInt(id),
//       },
//       orderBy: {
//         createdAt: 'desc',
//       },
//       include: {
//         user: {
//           select: {
//             id: true,
//             username: true,
//             name: true,
//             avatar: true,
//           },
//         },
//         _count: {
//           select: {
//             comments: true,
//             likes: true,
//           },
//         },
//       },
//     });
    
//     // Format videos with count data
//     const formattedVideos = videos.map(video => ({
//       ...video,
//       likeCount: video._count.likes,
//       commentCount: video._count.comments,
//       _count: undefined,
//     }));
    
//     res.status(200).json({
//       videos: formattedVideos,
//       totalVideos: videos.length
//     });
//   } catch (error) {
//     console.error(`Error getting videos for user ${req.params.id}:`, error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// Get videos for following feed
exports.getFollowingVideos = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { cursor, limit = 10 } = req.query;
    const limitNum = parseInt(limit) || 10;
    
    // Find users that the current user follows
    const following = await prisma.follow.findMany({
      where: {
        followerId: userId,
      },
      select: {
        followingId: true,
      },
    });
    
    const followingIds = following.map(follow => follow.followingId);
    
    // If user doesn't follow anyone, return empty result
    if (followingIds.length === 0) {
      return res.status(200).json({
        videos: [],
        pagination: {
          nextCursor: null,
          hasNextPage: false,
        },
      });
    }
    
    // Build query options
    const queryOptions = {
      where: {
        userId: {
          in: followingIds,
        },
      },
      take: limitNum + 1, // Take one extra to determine if there are more items
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true
          }
        }
      }
    };
    
    // If cursor is provided, filter records after the cursor
    if (cursor) {
      queryOptions.cursor = {
        id: parseInt(cursor),
      };
      queryOptions.skip = 1; // Skip the cursor itself
    }
    
    // Fetch videos from users the current user follows
    const videos = await prisma.video.findMany(queryOptions);
    
    // Check if there are more items
    const hasNextPage = videos.length > limitNum;
    
    // Remove the extra item we used to check for more data
    if (hasNextPage) {
      videos.pop();
    }
    
    // Format videos
    const formattedVideos = videos.map(video => ({
      ...video,
      likeCount: video._count.likes,
      commentCount: video._count.comments,
      _count: undefined,
    }));
    
    // Get the next cursor from the last item
    const nextCursor = hasNextPage ? formattedVideos[formattedVideos.length - 1].id.toString() : null;
    
    res.status(200).json({
      videos: formattedVideos,
      pagination: {
        nextCursor,
        hasNextPage,
      },
    });
  } catch (error) {
    console.error('Error getting following videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createVideo = async (req, res) => {
  try {
    const { caption, audioName } = req.body;
    const userId = req.user.id;
    
    // Get file paths from the uploaded files
    const videoUrl = req.files && req.files.video ? `/uploads/${req.files.video[0].filename}` : null;
    const thumbnailUrl = req.files && req.files.thumbnail ? `/uploads/${req.files.thumbnail[0].filename}` : null;
    
    if (!videoUrl) {
      return res.status(400).json({ message: 'Video file is required' });
    }
    
    // Create video in database
    const newVideo = await prisma.video.create({
      data: {
        caption,
        audioName,
        videoUrl,
        thumbnailUrl,
        userId: parseInt(userId)
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
    
    res.status(201).json(newVideo);
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({ message: 'Failed to create video' });
  }
};

// Update video
exports.updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, audioName } = req.body;
    const userId = req.user.id;
    
    // Check if video exists and belongs to user
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (video.userId !== parseInt(userId)) {
      return res.status(403).json({ message: 'Not authorized to update this video' });
    }
    
    // Update video
    const updatedVideo = await prisma.video.update({
      where: { id: parseInt(id) },
      data: {
        caption,
        audioName,
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
    
    res.status(200).json(updatedVideo);
  } catch (error) {
    console.error(`Error updating video ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to update video' });
  }
};

// Delete video
exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if video exists and belongs to user
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (video.userId !== parseInt(userId)) {
      return res.status(403).json({ message: 'Not authorized to delete this video' });
    }
    
    // Delete video
    await prisma.video.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(200).json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error(`Error deleting video ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to delete video' });
  }
};

// Like/unlike video
exports.toggleVideoLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Check if like already exists
    const existingLike = await prisma.videoLike.findUnique({
      where: {
        userId_videoId: {
          userId: parseInt(userId),
          videoId: parseInt(id)
        }
      }
    });
    
    let action;
    
    if (existingLike) {
      // Unlike - delete the like
      await prisma.videoLike.delete({
        where: {
          userId_videoId: {
            userId: parseInt(userId),
            videoId: parseInt(id)
          }
        }
      });
      action = 'unliked';
    } else {
      // Like - create a like
      await prisma.videoLike.create({
        data: {
          userId: parseInt(userId),
          videoId: parseInt(id)
        }
      });
      action = 'liked';
    }
    
    // Get updated like count
    const likeCount = await prisma.videoLike.count({
      where: { videoId: parseInt(id) }
    });
    
    res.status(200).json({
      message: `Video ${action} successfully`,
      action,
      likeCount
    });
  } catch (error) {
    console.error(`Error toggling like for video ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to toggle like' });
  }
};

// Get video comments
exports.getVideoComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    const comments = await prisma.comment.findMany({
     where: { videoId: parseInt(id) },
     orderBy: { createdAt: 'desc' },
     skip,
     take,
     include: {
       user: {
         select: {
           id: true,
           username: true,
           name: true,
           avatar: true
         }
       },
       _count: {
         select: { likes: true }
       }
     }
   });
   
   // If user is logged in, check if they've liked the comments
   if (req.user) {
     const userId = req.user.id;
     const commentIds = comments.map(comment => comment.id);
     
     const userLikes = await prisma.commentLike.findMany({
       where: {
         userId: parseInt(userId),
         commentId: {
           in: commentIds
         }
       }
     });
     
     // Add isLiked property to comments
     comments.forEach(comment => {
       comment.isLiked = userLikes.some(like => like.commentId === comment.id);
     });
   }
   
   // Get total count for pagination
   const totalComments = await prisma.comment.count({
     where: { videoId: parseInt(id) }
   });
   
   res.status(200).json({
     comments,
     totalPages: Math.ceil(totalComments / take),
     currentPage: parseInt(page),
     totalComments
   });
 } catch (error) {
   console.error(`Error fetching comments for video ${req.params.id}:`, error);
   res.status(500).json({ message: 'Failed to fetch comments' });
 }
};