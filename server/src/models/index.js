// In-memory data store for development
const dataStore = {
  videos: [],
  users: [],
  comments: [],
  nextIds: {
    videos: 1,
    users: 1,
    comments: 1
  }
};
// Create some initial data if in development
if (process.env.NODE_ENV === 'development') {
  // Add two users
  dataStore.users.push({
    id: dataStore.nextIds.users++,
    username: 'user1',
    email: 'user1@example.com',
    name: 'User One',
    followers: [],
    following: [],
    createdAt: new Date().toISOString()
  });
  
  dataStore.users.push({
    id: dataStore.nextIds.users++,
    username: 'user2',
    email: 'user2@example.com',
    name: 'User Two',
    followers: [],
    following: [],
    createdAt: new Date().toISOString()
  });
  
  // Add some videos
  dataStore.videos.push({
    id: dataStore.nextIds.videos++,
    title: 'First Video',
    description: 'This is my first video',
    url: 'https://example.com/video1.mp4',
    userId: 1,
    likes: [],
    createdAt: new Date().toISOString()
  });
  
  dataStore.videos.push({
    id: dataStore.nextIds.videos++,
    title: 'Second Video',
    description: 'Another awesome video',
    url: 'https://example.com/video2.mp4',
    userId: 2,
    likes: [],
    createdAt: new Date().toISOString()
  });
  
  // Add some comments
  dataStore.comments.push({
    id: dataStore.nextIds.comments++,
    text: 'Great video!',
    userId: 2,
    videoId: 1,
    likes: [],
    createdAt: new Date().toISOString()
  });
  
  dataStore.comments.push({
    id: dataStore.nextIds.comments++,
    text: 'Thanks for sharing',
    userId: 1,
    videoId: 2,
    likes: [],
    createdAt: new Date().toISOString()
  });
}

module.exports = dataStore;