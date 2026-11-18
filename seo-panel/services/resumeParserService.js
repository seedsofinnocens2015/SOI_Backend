const zlib = require('zlib');
const axios = require('axios');

/**
 * Extracts a specific file entry from a ZIP archive buffer using built-in zlib.
 */
function unzipEntry(buffer, targetName) {
  try {
    let offset = 0;
    while (offset < buffer.length - 30) {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) {
        offset++;
        continue;
      }
      const compression = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      const fileName = buffer.slice(offset + 30, offset + 30 + fileNameLen).toString('utf8');
      const dataStart = offset + 30 + fileNameLen + extraLen;
      const dataEnd = dataStart + compressedSize;

      if (fileName === targetName) {
        const rawData = buffer.slice(dataStart, dataEnd);
        if (compression === 0) {
          return rawData;
        } else if (compression === 8) {
          return zlib.inflateRawSync(rawData);
        }
      }
      offset = dataEnd;
    }
  } catch (err) {
    console.warn('unzipEntry error:', err.message);
  }
  return null;
}

/**
 * Extracts plain text from DOCX buffer.
 */
function extractDocxText(buffer) {
  try {
    const docXmlBuf = unzipEntry(buffer, 'word/document.xml');
    if (!docXmlBuf) return '';
    const xml = docXmlBuf.toString('utf8');
    return xml
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<w:br[^>]*>/gi, '\n')
      .replace(/<w:tab[^>]*>/gi, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  } catch (err) {
    console.warn('Docx extract error:', err.message);
    return '';
  }
}

/**
 * Parses a PDF /ToUnicode CMap string to map font character codes.
 */
function parseToUnicodeCMap(cmapStr) {
  const map = new Map();
  if (!cmapStr) return map;

  const bfCharBlocks = cmapStr.matchAll(/beginbfchar([\s\S]*?)endbfchar/g);
  for (const block of bfCharBlocks) {
    const lines = block[1].matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
    for (const line of lines) {
      const srcCode = parseInt(line[1], 16);
      const dstHex = line[2];
      let utf = '';
      for (let i = 0; i < dstHex.length; i += 4) {
        utf += String.fromCharCode(parseInt(dstHex.substring(i, i + 4), 16));
      }
      map.set(srcCode, utf);
    }
  }

  const bfRangeBlocks = cmapStr.matchAll(/beginbfrange([\s\S]*?)endbfrange/g);
  for (const block of bfRangeBlocks) {
    const lines = block[1].trim().split(/\r?\n/);
    for (let l of lines) {
      l = l.trim();
      const mRange = l.match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/);
      if (mRange) {
        const start = parseInt(mRange[1], 16);
        const end = parseInt(mRange[2], 16);
        let dst = parseInt(mRange[3], 16);
        for (let code = start; code <= end; code++, dst++) {
          map.set(code, String.fromCharCode(dst));
        }
        continue;
      }
      const mArr = l.match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[(.*?)\]/);
      if (mArr) {
        const start = parseInt(mArr[1], 16);
        const end = parseInt(mArr[2], 16);
        const hexList = mArr[3].match(/<([0-9a-fA-F]+)>/g) || [];
        for (let i = 0; i < hexList.length && start + i <= end; i++) {
          const hex = hexList[i].replace(/[<>]/g, '');
          map.set(start + i, String.fromCharCode(parseInt(hex, 16)));
        }
      }
    }
  }

  return map;
}

/**
 * Text stream builder that prevents artificial spaces inside emails, urls, and numbers.
 */
function createStreamTextBuilder() {
  let text = '';
  function append(str, isNewline = false) {
    if (!str) return;
    if (isNewline) {
      if (text.length > 0 && !text.endsWith('\n')) text += '\n';
      text += str;
      return;
    }
    if (text.length === 0 || text.endsWith('\n') || text.endsWith(' ') || text.endsWith('\t')) {
      text += str;
      return;
    }
    const lastChar = text.slice(-1);
    const firstChar = str.charAt(0);
    const isGlue = /[.@\-_/:\\]/.test(firstChar) || /[.@\-_/:\\]/.test(lastChar);
    if (!isGlue) {
      text += ' ';
    }
    text += str;
  }
  return {
    append,
    getText: () => text.trim()
  };
}

/**
 * Extracts plain text from PDF buffer using pure JS + Node zlib.
 */
function extractPdfText(buffer) {
  try {
    const binary = buffer.toString('binary');
    const globalCMap = new Map();
    let pos = 0;

    // 1. Collect CMaps
    while ((pos = binary.indexOf('/ToUnicode', pos)) !== -1) {
      const streamStart = binary.indexOf('stream', pos);
      if (streamStart !== -1 && streamStart - pos < 600) {
        let dataStart = streamStart + 6;
        if (binary[dataStart] === '\r') dataStart++;
        if (binary[dataStart] === '\n') dataStart++;
        const dataEnd = binary.indexOf('endstream', dataStart);
        if (dataEnd !== -1) {
          const raw = buffer.slice(dataStart, dataEnd);
          let uncompressed;
          try {
            uncompressed = zlib.inflateSync(raw);
          } catch {
            try {
              uncompressed = zlib.inflateRawSync(raw);
            } catch {
              uncompressed = raw;
            }
          }
          const cmapStr = uncompressed.toString('latin1');
          const parsed = parseToUnicodeCMap(cmapStr);
          for (const [k, v] of parsed.entries()) {
            globalCMap.set(k, v);
          }
        }
      }
      pos += 10;
    }

    function decodePiece(str, isHex) {
      if (isHex) {
        let hex = str.replace(/\s+/g, '');
        if (hex.length % 2 !== 0) hex += '0';
        let res = '';
        if (hex.length >= 4 && globalCMap.size > 0) {
          for (let i = 0; i < hex.length; i += 4) {
            const code = parseInt(hex.substring(i, i + 4), 16);
            res += globalCMap.get(code) || String.fromCharCode(code);
          }
        } else {
          for (let i = 0; i < hex.length; i += 2) {
            const code = parseInt(hex.substring(i, i + 2), 16);
            res += globalCMap.get(code) || String.fromCharCode(code);
          }
        }
        return res;
      }

      let res = '';
      let i = 0;
      while (i < str.length) {
        if (str[i] === '\\' && i + 1 < str.length) {
          const n = str[i + 1];
          if (n === 'n') { res += '\n'; i += 2; }
          else if (n === 'r') { res += '\r'; i += 2; }
          else if (n === 't') { res += '\t'; i += 2; }
          else if (n === 'b') { res += '\b'; i += 2; }
          else if (n === 'f') { res += '\f'; i += 2; }
          else if (n === '(' || n === ')' || n === '\\') { res += n; i += 2; }
          else if (/[0-7]/.test(n)) {
            let oct = n;
            let j = i + 2;
            while (j < str.length && /[0-7]/.test(str[j]) && j - i - 1 < 3) {
              oct += str[j++];
            }
            const code = parseInt(oct, 8);
            res += globalCMap.get(code) || String.fromCharCode(code);
            i = j;
          } else {
            res += n;
            i += 2;
          }
        } else {
          const code = str.charCodeAt(i);
          res += globalCMap.get(code) || str[i];
          i++;
        }
      }
      return res;
    }

    // 2. Iterate content streams
    const builder = createStreamTextBuilder();
    pos = 0;
    while ((pos = binary.indexOf('stream', pos)) !== -1) {
      const prevChar = binary[pos - 1];
      if (prevChar && !/[\r\n\s]/.test(prevChar)) {
        pos += 6;
        continue;
      }
      let dataStart = pos + 6;
      if (binary[dataStart] === '\r') dataStart++;
      if (binary[dataStart] === '\n') dataStart++;
      const dataEnd = binary.indexOf('endstream', dataStart);
      if (dataEnd === -1) break;

      const raw = buffer.slice(dataStart, dataEnd);
      pos = dataEnd + 9;

      let uncompressed;
      try {
        uncompressed = zlib.inflateSync(raw);
      } catch {
        try {
          uncompressed = zlib.inflateRawSync(raw);
        } catch {
          uncompressed = raw;
        }
      }

      const content = uncompressed.toString('latin1');
      if (!content.includes('Tj') && !content.includes('TJ') && !content.includes('ET')) {
        continue;
      }

      const btBlocks = content.matchAll(/BT([\s\S]*?)ET/g);
      for (const bt of btBlocks) {
        const block = bt[1];
        const lines = block.split(/\r?\n/);
        for (const line of lines) {
          const isLineShift = /\b(T\*|TD|Td|Tm)\b/.test(line);
          const tjMatches = line.matchAll(/(\((?:[^()\\]|\\.)*\)|<[0-9a-fA-F\s]+>)\s*(Tj|'|")/g);
          let firstInLine = true;
          for (const m of tjMatches) {
            const rawStr = m[1];
            const isHex = rawStr.startsWith('<');
            const cleanStr = decodePiece(rawStr.slice(1, -1), isHex);
            builder.append(cleanStr, (isLineShift && firstInLine) || m[2] !== 'Tj');
            firstInLine = false;
          }
          const tjArray = line.matchAll(/\[(.*?)\]\s*TJ/g);
          for (const ta of tjArray) {
            const items = ta[1].matchAll(/(\((?:[^()\\]|\\.)*\)|<[0-9a-fA-F\s]+>)|(-?\d+(?:\.\d+)?)/g);
            let pieceAccum = '';
            for (const item of items) {
              if (item[1]) {
                const rawStr = item[1];
                const isHex = rawStr.startsWith('<');
                pieceAccum += decodePiece(rawStr.slice(1, -1), isHex);
              } else if (item[2]) {
                const space = parseFloat(item[2]);
                if (space < -140) pieceAccum += ' ';
              }
            }
            if (pieceAccum) {
              builder.append(pieceAccum, isLineShift && firstInLine);
              firstInLine = false;
            }
          }
        }
        builder.append('', true);
      }
    }

    let text = builder.getText();

    if (text.trim().length < 50) {
      const asciiMatches = binary.match(/[\x20-\x7E\r\n\t]{4,}/g) || [];
      const filtered = asciiMatches
        .filter((s) => !/^(obj|endobj|xref|trailer|stream|endstream)/.test(s.trim()))
        .join(' ');
      if (filtered.length > text.length) {
        text = filtered;
      }
    }

    return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  } catch (err) {
    console.warn('PDF extract error:', err.message);
    return '';
  }
}

/**
 * Extracts plain text from legacy binary .doc by scanning printable ASCII.
 */
function extractDocText(buffer) {
  try {
    let str = '';
    let current = '';
    for (let i = 0; i < buffer.length; i++) {
      const b = buffer[i];
      if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
        current += String.fromCharCode(b);
      } else {
        if (current.length >= 4) str += current + ' ';
        current = '';
      }
    }
    if (current.length >= 4) str += current;
    return str.replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

/**
 * Comprehensive candidate data extractor from plain text and raw buffer.
 */
function extractCandidateDataFromText(fullText, fileName = '', rawBuffer = null) {
  const text = (fullText || '').replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rawBinary = rawBuffer ? rawBuffer.toString('binary') : '';

  const result = {
    candidateName: '',
    mobile: '',
    email: '',
    totalExpYrs: '',
    currentCtcLakh: '',
    expectedCtcLakh: '',
    noticePeriodDays: '',
    currentLocation: '',
    designation: '',
    department: '',
    source: '',
    remarks: '',
  };

  // 1. EMAIL EXTRACTION
  const ignoreEmails = /^(email@example\.com|yourname@email\.com|xyz@gmail\.com|user@domain\.com|candidate@email\.com)$/i;

  const mailtoMatch = text.match(/mailto:\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);
  if (mailtoMatch && !ignoreEmails.test(mailtoMatch[1])) {
    result.email = mailtoMatch[1].toLowerCase().trim();
  }

  if (!result.email) {
    const stdMatch = text.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
    if (stdMatch && !ignoreEmails.test(stdMatch[1])) {
      result.email = stdMatch[1].toLowerCase().trim();
    }
  }

  // Handle emails with spaces around @ or dots from font rendering
  if (!result.email) {
    const spacedMatch = text.match(/\b([A-Za-z0-9._%+-]+(?:\s*[._%+-]\s*[A-Za-z0-9._%+-]+)*)\s*@\s*([A-Za-z0-9-]+(?:\s*\.\s*[A-Za-z0-9-]+)+)\b/);
    if (spacedMatch) {
      const cleaned = (spacedMatch[1] + '@' + spacedMatch[2]).replace(/\s+/g, '').toLowerCase();
      if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cleaned) && !ignoreEmails.test(cleaned)) {
        result.email = cleaned;
      }
    }
  }

  // Raw binary fallback search for email
  if (!result.email && rawBinary) {
    const rawMatches = rawBinary.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    for (const em of rawMatches) {
      if (!ignoreEmails.test(em)) {
        result.email = em.toLowerCase();
        break;
      }
    }
  }

  // 2. MOBILE EXTRACTION
  const phonePatterns = [
    /(?:phone|mobile|mob|contact|tel|cell|call|whatsapp)?[:\s\-#]*(?:(?:\+|00)91[\s.-]?)?([6-9]\d{4}[\s.-]?\d{5})\b/i,
    /(?:(?:\+|00)91[\s.-]?)?([6-9]\d{4}[\s.-]?\d{5})\b/,
    /\b([6-9]\d{9})\b/,
  ];
  for (const reg of phonePatterns) {
    const match = text.match(reg);
    if (match) {
      const cleanDigits = (match[1] || match[0]).replace(/\D/g, '');
      if (cleanDigits.length === 10 && /^[6-9]\d{9}$/.test(cleanDigits)) {
        result.mobile = cleanDigits;
        break;
      }
      if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
        const candidate10 = cleanDigits.slice(2);
        if (/^[6-9]\d{9}$/.test(candidate10)) {
          result.mobile = candidate10;
          break;
        }
      }
    }
  }

  if (!result.mobile && rawBinary) {
    const rawDigits = rawBinary.match(/(?:(?:\+|00)91[\s.-]?)?([6-9]\d{9})\b/);
    if (rawDigits) {
      result.mobile = rawDigits[1];
    }
  }

  // 3. CANDIDATE NAME EXTRACTION
  const blocklistWords = new Set([
    'curriculum', 'vitae', 'resume', 'bio', 'data', 'biodata', 'profile', 'summary',
    'objective', 'career', 'personal', 'details', 'contact', 'info', 'information',
    'experience', 'work', 'history', 'employment', 'education', 'academic', 'qualification',
    'qualifications', 'skills', 'technical', 'competencies', 'strengths', 'declaration',
    'hobbies', 'interests', 'languages', 'reference', 'references', 'page', 'project',
    'projects', 'certifications', 'training', 'date', 'birth', 'gender', 'male', 'female',
    'marital', 'status', 'married', 'single', 'nationality', 'indian', 'address',
    'permanent', 'present', 'current', 'location', 'city', 'state', 'pincode', 'pin',
    'mobile', 'phone', 'telephone', 'email', 'mail', 'github', 'linkedin', 'portfolio',
    'hospital', 'clinic', 'healthcare', 'centre', 'center', 'ltd', 'limited', 'seeds',
    'innocence', 'nurse', 'nursing', 'officer', 'sister', 'doctor', 'embryologist',
    'technician', 'phlebotomist', 'pathologist', 'executive', 'manager', 'consultant',
    'specialist', 'coordinator', 'telecaller', 'billing', 'accounts', 'receptionist',
    'communication', 'leadership', 'management', 'teamwork', 'interpersonal',
    'analytical', 'clinical', 'patient', 'care', 'operations', 'administration',
    'english', 'hindi', 'application', 'applied', 'post', 'position', 'role', 'job',
    'title', 'new', 'delhi', 'noida', 'gurgaon', 'gurugram', 'mumbai', 'india'
  ]);

  function isBlockedName(line) {
    const words = line.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    for (const w of words) {
      if (blocklistWords.has(w)) return true;
    }
    return false;
  }

  // A) Explicit label
  const nameLabelMatch = text.match(/(?:candidate\s*name|full\s*name|^name)\s*[:\-]\s*([A-Za-z\t .]{2,40})/im);
  if (nameLabelMatch) {
    const cand = nameLabelMatch[1].replace(/^(mr|ms|mrs|dr)\.?\s+/i, '').trim();
    if (cand.length >= 3 && !isBlockedName(cand)) {
      result.candidateName = cand;
    }
  }

  // Clean name from filename
  let nameFromFilename = '';
  if (fileName) {
    const base = fileName.replace(/\.[^/.]+$/, '').replace(/[-_.]+/g, ' ');
    const cleaned = base
      .replace(/\b(cv|resume|updated|profile|latest|biodata|for|of|doc|pdf|docx|txt|final|new|soi|seeds|job|candidate|applicant|\d+)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 3 && cleaned.length <= 40 && !isBlockedName(cleaned)) {
      nameFromFilename = cleaned;
    }
  }

  // Name parts from email (e.g. priya.sharma92 -> ['priya', 'sharma'])
  const emailNameParts = [];
  if (result.email && result.email.includes('@')) {
    const userPart = result.email.split('@')[0].toLowerCase().replace(/[^a-z]/g, ' ');
    userPart.split(/\s+/).forEach((w) => {
      if (w.length >= 3 && !blocklistWords.has(w)) emailNameParts.push(w);
    });
  }

  // B) Top lines of resume with scoring
  if (!result.candidateName) {
    const candidates = [];
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      let l = lines[i].replace(/^(mr|ms|mrs|dr)\.?\s+/i, '').trim();
      l = l.replace(/[|,;].*$/, '').trim();
      if (
        l.length >= 3 &&
        l.length <= 35 &&
        /^[A-Za-z\s.]+$/.test(l) &&
        !/@/.test(l) &&
        !/\d/.test(l) &&
        !isBlockedName(l)
      ) {
        const words = l.split(/\s+/);
        if (words.length >= 1 && words.length <= 4) {
          let score = 10;
          const lower = l.toLowerCase();
          if (nameFromFilename && lower.includes(nameFromFilename.toLowerCase())) score += 50;
          if (nameFromFilename && nameFromFilename.toLowerCase().includes(lower)) score += 30;
          for (const ep of emailNameParts) {
            if (lower.includes(ep)) score += 25;
          }
          if (words.length === 1) score -= 5;
          candidates.push({ name: l, score, lineIndex: i });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex);
      const topCand = candidates[0];
      if (topCand.score <= 10 && nameFromFilename && nameFromFilename.split(/\s+/).length >= 2) {
        result.candidateName = nameFromFilename;
      } else {
        result.candidateName = topCand.name;
      }
    }
  }

  if (!result.candidateName && nameFromFilename) {
    result.candidateName = nameFromFilename;
  }

  if (!result.candidateName && emailNameParts.length > 0) {
    result.candidateName = emailNameParts
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // 4. TOTAL EXPERIENCE (YRS)
  const currentYear = new Date().getFullYear();

  // A) Fresher check
  if (
    /\b(?:fresher|fresh\s*graduate|entry\s*level|intern(?:ship)?\s*only)\b/i.test(text) &&
    !/\b(?:not\s*a\s*fresher|[1-9]\d*\s*(?:years?|yrs?)\s*exp)/i.test(text)
  ) {
    result.totalExpYrs = '0';
  }

  // B) Direct pattern
  if (!result.totalExpYrs) {
    const expPatterns = [
      /(?:total\s+)?(?:exp(?:erience)?|work\s*exp(?:erience)?)[:\s\-]+([0-9]+)\s*(?:years?|yrs?)(?:\s*(?:and|&)?\s*([0-9]+)\s*(?:months?|mos?|m))?/i,
      /(?:total\s+)?(?:exp(?:erience)?|work\s*exp(?:erience)?)[:\s\-]+([0-9]+(?:\.[0-9]+)?)\s*(?:\+?\s*(?:yrs?|years?))?/i,
      /(?:over|around|nearly|having|with)\s+([0-9]+(?:\.[0-9]+)?)\s*(?:\+?\s*(?:yrs?|years?))(?:\s*of)?(?:\s+[\w]{1,15})?\s*exp(?:erience)?/i,
      /([0-9]+(?:\.[0-9]+)?)\s*(?:\+?\s*(?:yrs?|years?))(?:\s*of)?(?:\s+[\w]{1,15})?\s*exp(?:erience)?/i,
      /([0-9]+(?:\.[0-9]+)?)\s*(?:\+?\s*(?:yrs?|years?))\s*experience/i,
      /(?:overall|relevant|industry)\s*exp(?:erience)?[:\s\-]+([0-9]+(?:\.[0-9]+)?)/i,
      /\b([0-9]+(?:\.[0-9]+)?)\s*\+\s*(?:yrs?|years?)\s*exp\b/i,
    ];
    for (const reg of expPatterns) {
      const match = text.match(reg);
      if (match) {
        const yrs = parseFloat(match[1]);
        const months = match[2] ? parseFloat(match[2]) : 0;
        const total = yrs + (months > 0 ? Math.round((months / 12) * 10) / 10 : 0);
        if (total >= 0 && total <= 50) {
          result.totalExpYrs = String(total);
          break;
        }
      }
    }
  }

  // C) "Working since YYYY"
  if (!result.totalExpYrs) {
    const sinceMatch = text.match(/(?:working\s+since|employed\s+since|since)\s+([12][09]\d\d)\b/i);
    if (sinceMatch) {
      const startYear = parseInt(sinceMatch[1], 10);
      if (startYear >= 1970 && startYear <= currentYear) {
        const diff = currentYear - startYear;
        if (diff >= 0 && diff <= 50) result.totalExpYrs = String(diff);
      }
    }
  }

  // D) Date ranges in experience section: (YYYY - Present) or (YYYY - YYYY)
  if (!result.totalExpYrs) {
    const dateRangeMatches = [
      ...text.matchAll(/\b([12][09]\d\d)\s*(?:-|–|—|to)\s*(present|till\s*date|now|current|[12][09]\d\d)\b/gi),
    ];
    if (dateRangeMatches.length > 0) {
      let earliestStart = currentYear;
      let latestEnd = 1970;
      let found = false;
      for (const m of dateRangeMatches) {
        const startYear = parseInt(m[1], 10);
        let endYear = currentYear;
        if (!/present|till|now|current/i.test(m[2])) {
          endYear = parseInt(m[2], 10);
        }
        if (startYear >= 1980 && startYear <= currentYear && endYear >= startYear && endYear <= currentYear + 1) {
          if (startYear < earliestStart) earliestStart = startYear;
          if (endYear > latestEnd) latestEnd = endYear;
          found = true;
        }
      }
      if (found && earliestStart <= currentYear && latestEnd > earliestStart) {
        const total = latestEnd - earliestStart;
        if (total >= 0 && total <= 50) {
          result.totalExpYrs = String(total);
        }
      }
    }
  }

  // 5. CURRENT CTC
  const currentCtcPatterns = [
    /(?:current|present|c\.?t\.?c\.?|fixed|in-?hand)\s*(?:ctc|salary|package)?[:\s\-]+(?:INR|Rs\.?|₹)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|lac|lpa|l)\b/i,
    /(?:current|present)\s*(?:ctc|salary|package)?[:\s\-]+(?:INR|Rs\.?|₹)?\s*([0-9,]{6,10})/i,
    /(?:c\.?t\.?c\.?)\s*[:\-]\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|lac|lpa|l)\b/i,
    /(?:current|present)\s*salary[:\s\-]+(?:INR|Rs\.?|₹)?\s*([0-9,]{4,6})\s*(?:pm|per\s*month|\/m)\b/i,
  ];
  for (const reg of currentCtcPatterns) {
    const match = text.match(reg);
    if (match) {
      let val = match[1].replace(/,/g, '');
      let num = parseFloat(val);
      if (/pm|month/i.test(match[0])) {
        num = Math.round(((num * 12) / 100000) * 10) / 10;
      } else if (num > 10000) {
        num = Math.round((num / 100000) * 10) / 10;
      }
      if (num >= 0.5 && num <= 150) {
        result.currentCtcLakh = String(num);
        break;
      }
    }
  }

  // 6. EXPECTED CTC
  const expectedCtcPatterns = [
    /(?:expected|exp\.?|e\.?c\.?t\.?c\.?)\s*(?:ctc|salary|package)?[:\s\-]+(?:INR|Rs\.?|₹)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|lac|lpa|l)\b/i,
    /(?:expected|exp\.?)\s*(?:ctc|salary|package)?[:\s\-]+(?:INR|Rs\.?|₹)?\s*([0-9,]{6,10})/i,
  ];
  for (const reg of expectedCtcPatterns) {
    const match = text.match(reg);
    if (match) {
      let val = match[1].replace(/,/g, '');
      let num = parseFloat(val);
      if (num > 10000) num = Math.round((num / 100000) * 10) / 10;
      if (num >= 0.5 && num <= 150) {
        result.expectedCtcLakh = String(num);
        break;
      }
    }
  }

  // 7. NOTICE PERIOD
  if (/\b(?:immediate\s*(?:joiner|joining)|serving\s*notice)\b/i.test(text)) {
    result.noticePeriodDays = '0';
  } else {
    const noticePatterns = [
      /(?:notice\s*period|notice)[:\s\-]+([0-9]+)\s*(?:days?|d)\b/i,
      /(?:notice\s*period|notice)[:\s\-]+([0-9]+)\s*(?:months?|m)\b/i,
      /(?:notice\s*period|notice)[:\s\-]+immediate\b/i,
      /([0-9]+)\s*(?:days?)\s*notice\b/i,
      /([0-9]+)\s*(?:months?)\s*notice\b/i,
    ];
    for (const reg of noticePatterns) {
      const match = text.match(reg);
      if (match) {
        if (/immediate/i.test(match[0])) {
          result.noticePeriodDays = '0';
          break;
        }
        const num = parseInt(match[1], 10);
        result.noticePeriodDays = /month/i.test(match[0]) ? String(num * 30) : String(num);
        break;
      }
    }
  }

  // 8. LOCATION
  const knownCities = [
    'New Delhi', 'Delhi', 'Noida', 'Greater Noida', 'Gurgaon', 'Gurugram',
    'Faridabad', 'Ghaziabad', 'Meerut', 'Lucknow', 'Kanpur', 'Patna', 'Ranchi',
    'Varanasi', 'Agra', 'Jaipur', 'Chandigarh', 'Dehradun', 'Kolkata', 'Mumbai',
    'Pune', 'Bengaluru', 'Bangalore', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Bhopal',
    'Indore', 'Bhubaneswar', 'Guwahati', 'Bareilly', 'Aligarh', 'Moradabad'
  ];
  const addrMatch = text.match(/(?:current\s*location|location|address|city)\s*[:\-]\s*([^\n\r]+)/i);
  const addrLine = addrMatch ? addrMatch[1] : '';
  for (const c of knownCities) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(addrLine)) {
      result.currentLocation = c;
      break;
    }
  }
  if (!result.currentLocation) {
    for (const c of knownCities) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(text)) {
        result.currentLocation = c;
        break;
      }
    }
  }

  // 9. DESIGNATION & DEPARTMENT
  const knownRoles = [
    { title: 'Senior Staff Nurse', dept: 'Nursing' },
    { title: 'Staff Nurse', dept: 'Nursing' },
    { title: 'Nursing Officer', dept: 'Nursing' },
    { title: 'OT Nurse', dept: 'Nursing' },
    { title: 'Senior Embryologist', dept: 'Embryology' },
    { title: 'Junior Embryologist', dept: 'Embryology' },
    { title: 'Embryologist', dept: 'Embryology' },
    { title: 'Lab Technician', dept: 'Lab Operations' },
    { title: 'Phlebotomist', dept: 'Lab Operations' },
    { title: 'Pathologist', dept: 'Pathology' },
    { title: 'Patient Care Coordinator', dept: 'Patient Coordination' },
    { title: 'IVF Coordinator', dept: 'Patient Coordination' },
    { title: 'Counselor', dept: 'Patient Coordination' },
    { title: 'Front Desk Executive', dept: 'Admin & Operations' },
    { title: 'Center Manager', dept: 'Admin & Operations' },
    { title: 'HR Executive', dept: 'Human Resources' },
    { title: 'HR Manager', dept: 'Human Resources' },
    { title: 'Talent Acquisition', dept: 'Human Resources' },
    { title: 'SEO Executive', dept: 'Digital Marketing' },
    { title: 'Digital Marketing Specialist', dept: 'Digital Marketing' },
    { title: 'Accounts Executive', dept: 'Accounts & Finance' },
    { title: 'Billing Executive', dept: 'Billing' },
    { title: 'Pharmacist', dept: 'Pharmacy' },
    { title: 'Telecaller', dept: 'Call Center' },
  ];

  const desigLabelMatch = text.match(
    /(?:designation|current\s*role|\brole\b|current\s*position|job\s*title|profile|applying\s*for)\s*[:\-]\s*([^\n\r,;|]+)/i
  );
  if (desigLabelMatch && desigLabelMatch[1].trim()) {
    result.designation = desigLabelMatch[1].trim();
  }

  const sortedKnownRoles = [...knownRoles].sort((a, b) => b.title.length - a.title.length);

  if (!result.designation) {
    for (const r of sortedKnownRoles) {
      if (new RegExp(`\\b${r.title}\\b`, 'i').test(text)) {
        result.designation = r.title;
        result.department = r.dept;
        break;
      }
    }
  } else if (!result.department) {
    for (const r of sortedKnownRoles) {
      if (new RegExp(`\\b${r.title}\\b`, 'i').test(result.designation)) {
        result.department = r.dept;
        break;
      }
    }
  }

  // 10. SOURCE
  if (/\b(?:naukri|naukri\.com)\b/i.test(text)) {
    result.source = 'Naukri';
  } else if (/\blinkedin\b/i.test(text)) {
    result.source = 'LinkedIn';
  } else if (/\bindeed\b/i.test(text)) {
    result.source = 'Indeed';
  }

  // 11. REMARKS
  const skillsMatch = text.match(/(?:key\s*skills|skills|technologies|expertise)\s*[:\-]\s*([^\n\r]+)/i);
  const eduMatch = text.match(/(?:education|qualification)\s*[:\-]\s*([^\n\r]+)/i);
  const remarksParts = [];
  if (skillsMatch && skillsMatch[1].trim()) {
    remarksParts.push(`Skills: ${skillsMatch[1].trim().slice(0, 150)}`);
  }
  if (eduMatch && eduMatch[1].trim()) {
    remarksParts.push(`Edu: ${eduMatch[1].trim().slice(0, 80)}`);
  }
  if (remarksParts.length > 0) {
    result.remarks = remarksParts.join(' | ');
  }

  return result;
}

/**
 * Attempts AI parsing using Gemini API ONLY if a valid Google AI Studio key is configured.
 */
async function parseWithGeminiIfAvailable(extractedText) {
  const apiKey = process.env.GEMINI_API_KEY;
  // Valid Google AI Studio keys start with "AIzaSy"
  if (!apiKey || !apiKey.startsWith('AIzaSy') || !extractedText || extractedText.length < 20) {
    return null;
  }

  try {
    const prompt = `Extract candidate details from this resume text as a clean JSON object with these exact keys:
- candidateName: Full name of candidate (string)
- mobile: 10-digit Indian mobile number (digits only, no +91 or 0 prefix)
- email: Candidate email (string)
- totalExpYrs: Total experience in years (string/number, e.g. "4.5" or "3")
- currentCtcLakh: Current CTC in Lakhs (e.g. "5.5")
- expectedCtcLakh: Expected CTC in Lakhs (e.g. "7.0")
- noticePeriodDays: Notice period in days (e.g. "30", or "0" if immediate)
- currentLocation: Candidate city or location (string)
- designation: Current or target designation/role (string)
- department: Department (e.g. Nursing, Embryology, Lab Operations, Human Resources, Digital Marketing, Admin & Operations, Billing, Pharmacy, Accounts & Finance)
- source: Source if mentioned (e.g. Naukri, LinkedIn, Indeed)
- remarks: Summary of key skills and education (string)

Resume Text:
${extractedText.slice(0, 8000)}

Return ONLY a valid JSON object matching the keys above.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      },
      { timeout: 7000 }
    );

    const rawJson = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    }
  } catch (err) {
    // Silently continue to rule-based parser
  }
  return null;
}

/**
 * Main server-side resume parser entry.
 */
async function parseResumeBuffer(buffer, originalName = '') {
  const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
  let extractedText = '';

  if (ext === '.docx') {
    extractedText = extractDocxText(buffer);
  } else if (ext === '.pdf') {
    extractedText = extractPdfText(buffer);
  } else if (ext === '.doc') {
    extractedText = extractDocText(buffer);
  } else {
    try {
      extractedText = buffer.toString('utf8');
    } catch {
      extractedText = '';
    }
  }

  // Attempt Gemini if valid key configured
  let data = await parseWithGeminiIfAvailable(extractedText);
  let method = 'ai';

  if (!data || !data.candidateName) {
    method = 'regex';
    const regexData = extractCandidateDataFromText(extractedText, originalName, buffer);
    data = { ...(data || {}), ...regexData };
  }

  return {
    ok: true,
    data,
    method,
    textLength: extractedText.length,
  };
}

module.exports = {
  parseResumeBuffer,
  extractDocxText,
  extractPdfText,
  extractDocText,
  extractCandidateDataFromText,
};
