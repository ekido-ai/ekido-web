//! Names, from lists of common Indian first names and surnames. A name is removed when a first name is followed by a
//! surname, or when a first name comes right after a cue word ("naam", "Mr", "Customer"). Names that are not on the
//! lists are missed; that limit is real and is reported in the measurements.

use crate::{Kind, Span};

const FIRST: &[&str] = &[
    "aarav", "aditya", "aditi", "akash", "akshay", "amit", "amita", "anand", "ananya", "anil", "anita", "anjali", "ankit", "anu", "anuj", "arjun", "arun",
    "aryan", "asha", "ashok", "ayush", "bharat", "chetan", "deepa", "deepak", "dev", "devendra", "dinesh", "divya", "gaurav", "geeta", "gopal", "harish",
    "harsh", "hema", "isha", "ishaan", "jaya", "jyoti", "kabir", "kajal", "kamal", "karan", "kavita", "kiran", "krishna", "kunal", "lakshmi", "lalit",
    "madhu", "mahesh", "manish", "manoj", "meena", "meera", "mohan", "mohit", "mukesh", "nandini", "naveen", "neha", "nikhil", "nisha", "pankaj", "pooja",
    "prakash", "pranav", "prateek", "priya", "rahul", "rajesh", "rajiv", "rakesh", "ramesh", "ravi", "rekha", "rohan", "rohit", "sachin", "sandeep",
    "sanjay", "sapna", "sarita", "saurabh", "seema", "shweta", "simran", "sneha", "sonal", "sonia", "sunil", "sunita", "suresh", "swati", "tanvi", "tarun",
    "usha", "varun", "vijay", "vikas", "vikram", "vinay", "vishal", "vivek", "yash", "yogesh",
];

const LAST: &[&str] = &[
    "agarwal", "ahuja", "bansal", "bhat", "chauhan", "chopra", "das", "desai", "dubey", "gandhi", "garg", "gill", "gupta", "iyer", "jain", "joshi", "kapoor",
    "khan", "khanna", "kulkarni", "kumar", "malhotra", "mehta", "mishra", "nair", "pandey", "patel", "rao", "reddy", "saxena", "sharma", "shah", "sinha",
    "singh", "tiwari", "thakur", "verma", "yadav",
];

const FIRST_DEVA: &[&str] = &[
    "राहुल", "प्रिया", "अमित", "स्नेहा", "विक्रम", "अंजलि", "रोहन", "पूजा", "करण", "नेहा", "सुरेश", "कविता", "दीपक", "मीना", "अर्जुन", "दिव्या", "मनोज",
    "सुनीता", "रवि", "ईशा", "अनिल", "सुनील", "रमेश", "गीता", "संजय", "विजय",
];

const LAST_DEVA: &[&str] = &[
    "शर्मा", "वर्मा", "गुप्ता", "सिंह", "पटेल", "अय्यर", "रेड्डी", "नायर", "जोशी", "मेहता", "कुलकर्णी", "यादव", "दास", "बंसल", "चौहान", "मिश्रा", "पांडे", "जैन",
];

const CUES: &[&str] = &["name", "naam", "mr", "mrs", "ms", "shri", "smt", "sri", "customer", "नाम", "श्री", "श्रीमती"];

fn is_letter(c: char) -> bool {
    c.is_alphabetic() || ('\u{0900}'..='\u{097F}').contains(&c) // Devanagari signs and vowel marks are not "alphabetic" in every case
}

/// (start, end, lower-cased token) for each run of letters.
fn tokens(chars: &[char]) -> Vec<(usize, usize, String)> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if is_letter(chars[i]) {
            let start = i;
            while i < chars.len() && is_letter(chars[i]) {
                i += 1;
            }
            out.push((start, i, chars[start..i].iter().flat_map(|c| c.to_lowercase()).collect()));
        } else {
            i += 1;
        }
    }
    out
}

fn is_first(t: &str) -> bool {
    FIRST.contains(&t) || FIRST_DEVA.contains(&t)
}

fn is_last(t: &str) -> bool {
    LAST.contains(&t) || LAST_DEVA.contains(&t)
}

pub fn find(chars: &[char]) -> Vec<Span> {
    let toks = tokens(chars);
    let mut out = Vec::new();
    let mut i = 0;
    while i < toks.len() {
        let (start, end, ref word) = toks[i];
        if is_first(word) {
            let joined_by_space = |a: usize, b: usize| chars[a..b].iter().all(|c| *c == ' ');
            if i + 1 < toks.len() && is_last(&toks[i + 1].2) && joined_by_space(end, toks[i + 1].0) {
                out.push(Span { start, end: toks[i + 1].1, kind: Kind::Name });
                i += 2;
                continue;
            }
            let cue = i >= 1 && CUES.contains(&toks[i - 1].2.as_str()) && chars[toks[i - 1].1..start].iter().all(|c| *c == ' ' || *c == '.');
            let name_is = i >= 2 && matches!((toks[i - 2].2.as_str(), toks[i - 1].2.as_str()), ("name", "is") | ("naam", "hai"));
            if cue || name_is {
                out.push(Span { start, end, kind: Kind::Name });
            }
        }
        i += 1;
    }
    out
}
