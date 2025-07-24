import 'dotenv/config';
import axios from 'axios';

const {
  API_KEY,
  GUILD_NAME,
  GUILD_RANK,
  LEVEL_THRESHOLD,
  WEBHOOK_URL,
  PING_USER_ID
} = process.env;

const lastPings = new Map();

const getGuildData = async () => {
  const url = `https://api.hypixel.net/v2/guild?name=${encodeURIComponent(GUILD_NAME)}&key=${API_KEY}`;
  const { data } = await axios.get(url);
  return data.guild;
};

const getUUIDToName = async (uuid) => {
  try {
    const res = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
    return res.data.name;
  } catch {
    return 'Unknown';
  }
};

const getProfiles = async (uuid) => {
  const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${uuid}&key=${API_KEY}`);
  return data.profiles || [];
};

const getHighestLevel = (profiles, uuid) => {
  let highest = 0;
  for (const profile of profiles) {
    const member = profile.members?.[uuid];
    const exp = member?.leveling?.experience ?? 0;
    const level = Math.floor(exp / 100); // Flat 100 XP per level
    if (level > highest) highest = level;
  }
  return highest;
};

const sendWebhook = async (name, level) => {
  const payload = {
    content: `<@${PING_USER_ID}> ${name} is now above level ${LEVEL_THRESHOLD}\`\`\`/promote username:${name}\`\`\``,
  };
  await axios.post(WEBHOOK_URL, payload);
  console.log(`[WEBHOOK] Sent ping for ${name}`);
};

const runScan = async () => {
  console.log('[SCAN] Starting scan...');

  const guild = await getGuildData();
  if (!guild) return console.error('[ERROR] Guild not found');

  const now = Date.now();

  for (const member of guild.members) {
    if (member.rank !== GUILD_RANK) continue;

    const uuid = member.uuid;
    const lastPing = lastPings.get(uuid) || 0;

    // Check if it has been 3 hours (10_800_000 ms)
    if (now - lastPing < 3 * 60 * 60 * 1000) {
      console.log(`[SKIP] ${uuid} was already pinged in the last 3 hours`);
      continue;
    }

    const profiles = await getProfiles(uuid);
    const level = getHighestLevel(profiles, uuid);

    if (level > Number(LEVEL_THRESHOLD)) {
      const name = await getUUIDToName(uuid);
      await sendWebhook(name, level);
      lastPings.set(uuid, now);
    } else {
      console.log(`[INFO] ${uuid} is level ${level}, below threshold`);
    }
  }

  console.log('[SCAN] Done.');
};

runScan().catch(console.error);
