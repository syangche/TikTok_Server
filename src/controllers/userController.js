const prisma = require('../lib/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            videos: true,
            followedBy: true,
            following: true
          }
        }
      }
    });
    
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            videos: true,
            followedBy: true,
            following: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error(`Error fetching user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

exports.registerUser = async (req, res) => {
  try {
    // Extract user data
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const userExists = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });
    
    if (userExists) {
      return res.status(400).json({ 
        message: userExists.email === email 
          ? 'Email already in use' 
          : 'Username already in use' 
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword
      }
    });
    
    // Return success without password
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(200).json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

// Get videos by user with cursor-based pagination
exports.getUserVideos = async (req, res) => {
  try {
    const { userId } = req.params;
    const { cursor, limit = 10 } = req.query;
    const limitNum = parseInt(limit) || 10;
    
    // Check if user exists
    const userExists = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });
    
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Build query options
    const queryOptions = {
      where: {
        userId: parseInt(userId),
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
    
    // Get user's videos
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
    console.error(`Error getting videos for user ${req.params.userId}:`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    // Log what's being received
    console.log('Update user request body:', req.body);
    console.log('Update user request files:', req.files);
    
    // Extract form data
    const { name, bio } = req.body;
    let avatarPath = null;
    
    // Handle avatar file if uploaded
    if (req.files && req.files.avatar) {
      const avatarFile = req.files.avatar[0];
      avatarPath = `/uploads/${avatarFile.filename}`;
    }
    
    // Build update data object
    const updateData = {
      ...(name && { name }),
      ...(bio && { bio }),
      ...(avatarPath && { avatar: avatarPath }),
    };
    
    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    
    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error(`Error updating user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete user
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(`Error deleting user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

// Get user videos
exports.getUserVideos = async (req, res) => {
  try {
    const { id } = req.params;
    
    const videos = await prisma.video.findMany({
      where: { userId: parseInt(id) },
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.status(200).json(videos);
  } catch (error) {
    console.error(`Error fetching videos for user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch user videos' });
  }
};

// Get user followers
exports.getUserFollowers = async (req, res) => {
  try {
    const { id } = req.params;
    
    const followers = await prisma.follow.findMany({
      where: { followingId: parseInt(id) },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        }
      }
    });
    
    const formattedFollowers = followers.map(follow => follow.follower);
    
    res.status(200).json(formattedFollowers);
  } catch (error) {
    console.error(`Error fetching followers for user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch followers' });
  }
};

// Get user following
exports.getUserFollowing = async (req, res) => {
  try {
    const { id } = req.params;
    
    const following = await prisma.follow.findMany({
      where: { followerId: parseInt(id) },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        }
      }
    });
    
    const formattedFollowing = following.map(follow => follow.following);
    
    res.status(200).json(formattedFollowing);
  } catch (error) {
    console.error(`Error fetching following for user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch following' });
  }
};

exports.followUser = async (req, res) => {
  try {
    const { id } = req.params; // User to follow
    const currentUserId = req.user.id; // Current user
    
    console.log(`User ${currentUserId} is trying to follow user ${id}`);
    
    // Prevent following yourself
    if (parseInt(id) === currentUserId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }
    
    // Create follow relationship
    await prisma.follow.create({
      data: {
        followerId: currentUserId,
        followingId: parseInt(id)
      }
    });
    
    // Get updated follower count
    const followerCount = await prisma.follow.count({
      where: {
        followingId: parseInt(id)
      }
    });
    
    res.status(200).json({ 
      message: 'User followed successfully',
      followerCount
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const { id } = req.params; // User to unfollow
    const currentUserId = req.user.id; // Current user
    
    console.log(`User ${currentUserId} is trying to unfollow user ${id}`);
    
    // Delete follow relationship
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: parseInt(id)
        }
      }
    });
    
    // Get updated follower count
    const followerCount = await prisma.follow.count({
      where: {
        followingId: parseInt(id)
      }
    });
    
    res.status(200).json({ 
      message: 'User unfollowed successfully',
      followerCount
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};