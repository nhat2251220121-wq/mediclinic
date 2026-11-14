const getClinicClock = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter((part) => part.type !== 'literal');
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${fields.year}-${fields.month}-${fields.day}`,
    dateTime: `${fields.year}-${fields.month}-${fields.day} ${fields.hour}:${fields.minute}:${fields.second}`
  };
};

module.exports = { getClinicClock };
