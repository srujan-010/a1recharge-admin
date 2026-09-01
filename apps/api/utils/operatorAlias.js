const getOperatorCodeAliases = (identifier = '') => {
  const clean = String(identifier || '').trim().toUpperCase();
  const map = {
    'A': ['A', 'AT', 'AIRTEL'],
    'AT': ['A', 'AT', 'AIRTEL'],
    'AIRTEL': ['A', 'AT', 'AIRTEL'],
    'RC': ['RC', 'JO', 'JIO', 'RELIANCE - JIO', 'RELIANCE JIO'],
    'JO': ['RC', 'JO', 'JIO', 'RELIANCE - JIO', 'RELIANCE JIO'],
    'JIO': ['RC', 'JO', 'JIO', 'RELIANCE - JIO', 'RELIANCE JIO'],
    'V': ['V', 'VI', 'VODAFONE', 'IDEA', 'I'],
    'VI': ['V', 'VI', 'VODAFONE', 'IDEA', 'I'],
    'VODAFONE': ['V', 'VI', 'VODAFONE', 'IDEA', 'I'],
    'BT': ['BT', 'BR', 'BS', 'BSNL', 'BSNL TOPUP', 'BSNL-TOPUP', 'BSNL STV', 'BSNL SPECIAL'],
    'BR': ['BT', 'BR', 'BS', 'BSNL', 'BSNL TOPUP', 'BSNL-TOPUP', 'BSNL STV', 'BSNL SPECIAL'],
    'BS': ['BT', 'BR', 'BS', 'BSNL', 'BSNL TOPUP', 'BSNL-TOPUP', 'BSNL STV', 'BSNL SPECIAL'],
    'BSNL': ['BT', 'BR', 'BS', 'BSNL', 'BSNL TOPUP', 'BSNL-TOPUP', 'BSNL STV', 'BSNL SPECIAL'],
    'BSNL TOPUP': ['BT', 'BR', 'BS', 'BSNL', 'BSNL TOPUP', 'BSNL-TOPUP', 'BSNL STV', 'BSNL SPECIAL'],
    'BSNL-TOPUP': ['BT', 'BR', 'BS', 'BSNL', 'BSNL TOPUP', 'BSNL-TOPUP', 'BSNL STV', 'BSNL SPECIAL'],
    'TP': ['TP', 'TTV', 'TATA PLAY', 'TATA SKY'],
    'TTV': ['TP', 'TTV', 'TATA PLAY', 'TATA SKY'],
    'DISH': ['DISH', 'DTV', 'DISH TV'],
    'DTV': ['DISH', 'DTV', 'DISH TV'],
    'SUN': ['SUN', 'STV', 'SUN DIRECT'],
    'STV': ['SUN', 'STV', 'SUN DIRECT'],
    'VTV': ['VTV', 'VIDEOCON', 'D2H', 'VIDEOCON D2H'],
    'ATV': ['ATV', 'AIRDTH', 'AIRTEL DTH'],
  };

  if (map[clean]) return map[clean];

  if (clean.includes('BSNL')) return ['BT', 'BR', 'BS', 'BSNL', 'BSNL TOPUP', 'BSNL-TOPUP', 'BSNL STV', 'BSNL SPECIAL'];
  if (clean.includes('AIRTEL')) return ['A', 'AT', 'AIRTEL', 'AIRDTH', 'ATV'];
  if (clean.includes('JIO') || clean.includes('RELIANCE')) return ['RC', 'JO', 'JIO', 'RELIANCE - JIO', 'RELIANCE JIO'];
  if (clean.includes('VI') || clean.includes('VODAFONE') || clean.includes('IDEA')) return ['V', 'VI', 'VODAFONE', 'IDEA', 'I'];
  if (clean.includes('TATA')) return ['TP', 'TTV', 'TATA PLAY', 'TATA SKY'];
  if (clean.includes('DISH')) return ['DISH', 'DTV', 'DISH TV'];
  if (clean.includes('SUN')) return ['SUN', 'STV', 'SUN DIRECT'];
  if (clean.includes('VIDEOCON') || clean.includes('D2H')) return ['VTV', 'VIDEOCON', 'D2H', 'VIDEOCON D2H'];

  return [clean];
};

module.exports = { getOperatorCodeAliases };
