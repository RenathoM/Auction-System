const redis = require('redis');

async function checkRedisData() {
  const redisClient = redis.createClient({
    url: 'redis://default:GXpaeZBLEimkAjhcFwHsXfbyFbkpdMab@switchback.proxy.rlwy.net:39315'
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));

  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    const keys = ['INVENTORYSAVES', 'TRADESAVES', 'GIVEAWAYSAVES', 'FINISHEDGIVEAWAYSAVES', 'USERTRADECOUNTSAVES', 'USERGIVEAWAYCOUNTSAVES', 'REDIRECTSAVES'];

    for (const key of keys) {
      const value = await redisClient.get(key);
      if (value) {
        console.log(`${key}: ${value.substring(0, 100)}...`);
      } else {
        console.log(`${key}: not found`);
      }
    }

    await redisClient.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRedisData();
