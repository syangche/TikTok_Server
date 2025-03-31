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

// Register new user
exports.registerUser = async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username 
          ? 'Username already taken' 
          : 'Email already registered' 
      });
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create the user
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        name: name || username
      }
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
};

// Login user
exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(200).json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ message: 'Failed to login' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, bio, avatar } = req.body;
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        name,
        bio,
        avatar,
        updatedAt: new Date()
      }
    });
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;
    
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error(`Error updating user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to update user' });
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

// Follow user
exports.followUser = async (req, res) => {
  try {
    const { id } = req.params; // User to follow
    const followerId = req.user.id; // User making the request
    
    // Check if users exist
    const userToFollow = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!userToFollow) {
      return res.status(404).json({ message: 'User to follow not found' });
    }
    
    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: parseInt(followerId),
          followingId: parseInt(id)
        }
      }
    });
    
    if (existingFollow) {
      return res.status(400).json({ message: 'Already following this user' });
    }
    
    // Create follow relationship
    await prisma.follow.create({
      data: {
        followerId: parseInt(followerId),
        followingId: parseInt(id)
      }
    });
    
    res.status(200).json({ message: 'Successfully followed user' });
  } catch (error) {
    console.error(`Error following user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to follow user' });
  }
};

// Unfollow user
exports.unfollowUser = async (req, res) => {
  try {
    const { id } = req.params; // User to unfollow
    const followerId = req.user.id; // User making the request
    
    // Check if follow relationship exists
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: parseInt(followerId),
          followingId: parseInt(id)
        }
      }
    });
    
    if (!follow) {
      return res.status(400).json({ message: 'Not following this user' });
    }
    
    // Delete follow relationship
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: parseInt(followerId),
          followingId: parseInt(id)
        }
      }
    });
    
    res.status(200).json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    console.error(`Error unfollowing user ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to unfollow user' });
  }
};