# Code cards

This is the simplest form of "code cards"; they're designed so you can create cards directly within the Anki interface.

## Setup

There is an [AutoHotKey](https://www.autohotkey.com/) script in this directory, called `anki_shortcuts`. If you aren't familiar with AutoHotKey, a quick summary: it allows you to program specific combinations of keys to perform certain scripted actions. In this case, the script assigns the shortcuts `Alt+s` to create spoilers, and `Alt+i` and `Alt+k` to create the elements of a code block.

To run this script, you just have to download AutoHotKey from the link above, then download the AutoHotKey file in the directory. You need to double-click it to run the file (I recommend putting the file on your desktop so you can do this when your computer restarts). I think there's a way to make the script start from runtime automatically, but I haven't put in the time to find it!

## Creating cards

Once you've run the AutoHotKey script, and created a card template with the right front/back/style component, you're ready to create cards.

### Spoilers

If you press `Ctrl+Shift+x` when editing in Anki, you can open the HTML editor. This allows you to see the source HTML of your card. Highlight the text that you want to spoiler-ify, and press `Alt+s`. If the AutoHotKey file is working, this should replace the text with an HTML spoiler element, e.g. doing this for `The answer is X.` with `X` highlighted will replace it with `The answer is <span class="spoiler">X</span>.`

### Code inputs

The steps to creating a code block with inputs are as follows:
* Copy the code font (either from your IDE, or `Ctrl+x` if you've written it within the Anki editor)
* Open the HTML editor with `Ctrl+Shift+x`
* Put your cursor where you want the code to go, and press `Alt+i`, if the AHK script is working then this should copy in your code and style it like a code block
* Highlight a section you want to turn into an input, and press `Alt+k` (this works just like spoiler cards), this will replace it with an input element

You can do this for as many different elements in your code block as possible (although it's recommended to not have the inputs overflowing onto the next line).

An example is shown below: the code in the HTML editor before using `Alt+i` and `Alt+k`, the code after doing those things, and what the card looks like.

![image](https://user-images.githubusercontent.com/45238458/164966857-80e62c0b-0108-49dd-80ab-98c93521a603.png)
![image](https://user-images.githubusercontent.com/45238458/164966882-7fa24120-9895-422c-a762-c20ebc1fb137.png)
![image](https://user-images.githubusercontent.com/45238458/164966890-1e88b85b-60b5-4ecc-b644-b38fd39b36e0.png)

### Fonts

I've included two non-standard fonts: [Hind Regular](https://fonts.google.com/specimen/Hind) and [Alegreya Sans SC Regular](https://fonts.google.com/specimen/Alegreya+Sans+SC) (for the normal text and for the tags respectively). This is just personal preference because I think they look nice! If you want to use them, you can go to these sites to download then install them. If not, you can just remove them from the `Styling` file, or replace them with your preferred font.

### Hints

If you fill in the `Hint` field, then the hint will show up as a blue box which you click on to reveal. When you flip the card, it will be revealed automatically.

If you don't fill it in, no box will appear.

### Tags

Your tags should be structured as follows: `content::C1::C2::C3 src::S1::S2::S3`. The `Cn` and `Sn` stand for hierarchically-labelled content and source tags respectively. You don't have to fill in all the numbers (e.g. the imaage below used `content::Deep_Learning::Neural_Nets::GANs src::fast.ai`. You can use more than three content or source tags, but they won't be shown when you review the card.

If you've filled in the `URL` field, then the first of the `src` tags will be a hyperlink to that url.

### URL

If you fill in the `URL` field, then the first `src` tag will be replaced with a hyperlink to that url. **Key point** - make sure to copy the URL as raw text (by doing `Ctrl+Shift+v`). If you don't, then it will show up as blue in the Anki editor, and it won't work. One way to check this is to press `Ctrl+Shift+x` to open the HTML editor, and check that the URL only appears as raw text there.

If you don't fill in this field, then there will be no hyperlink, but the tags will still work fine.

## Studying cards

You can study these just like regular cards. You can tab through the input boxes and type in answers. When you flip the card, they'll be marked with either red (incorrect) or green (correct). These won't affect the card's spacing; you still need to click Again/Hard/Good/Easy like usual.
