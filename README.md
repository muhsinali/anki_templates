# Code cards for Anki

A lightweight template for creating interactive code input flashcards directly in Anki. Ideal for on the go study on desktop or mobile, these cards remove common friction points so you can focus on learning

## Features
1. Spellcheck & autocorrect Disabled: No more battling your keyboard when entering code
2. Autofocus on first input: Jump straight into the first field—no extra clicks
3. Smart quote normalization: Curly quotes convert to straight quotes, and all whitespace is stripped on answer check. Perfect for mobile typing

## Studying cards
You can study these just like regular cards. You can tab through the input boxes and type in answers

After flipping, correct/incorrect inputs highlight in green/red without altering layout

Grading (Again/Hard/Good/Easy) remains the same as standard Anki


## Setup
1. Open Anki and navigate to `Tools --> Manage Note Types`
2. Click the `Add` button on the right, then choose `Add: Basic`
3. Provide a name for the card template
4. Select your new note type and then click the `Fields` button
5. Ensure you have the following fields created in the following order. Click `Save` once done:
    1. Front
    2. Back
    3. Hint
    4. URL
6. Then click the `Cards` button on the right and copy and paste the HTMl and CSS from the `code_cards` directory in this repo:
    - Front template: Paste contents of front_template.html
    - Back template: Paste contents of back_template.html
    - Styling: Paste contents of styling.css
7. Also feel free to adjust these templates to your preferences

## Creating cards
Once you've created a card template as detailed above, you're ready to create cards

### Code inputs
If you press `Ctrl+Shift+x` when editing in Anki, you can open the HTML editor. This allows you to see the source HTML of your card

The steps to creating a code block with inputs are as follows:
1. Open the HTML editor with `Ctrl+Shift+x`
2. Put your cursor where you want the code to go, and insert a code block with an input element. Example:
```
<div class="exerciseprecontainer">
    <pre>
        <input maxlength="100" name="expected-input" style="width: 20ch;">
    </pre>
</div>
```
3. You can adjust the input field size by adjusting the `maxlength` and `style` attributes of the input element
4. Repeat for each input—avoid line overflow where possible

An example is shown below: the code in the HTML editor before inserting input forms, the code after inserting those things, and what the card looks like

![image](https://user-images.githubusercontent.com/45238458/164966857-80e62c0b-0108-49dd-80ab-98c93521a603.png)
![image](https://user-images.githubusercontent.com/45238458/164966882-7fa24120-9895-422c-a762-c20ebc1fb137.png)
![image](https://user-images.githubusercontent.com/45238458/164966890-1e88b85b-60b5-4ecc-b644-b38fd39b36e0.png)

### Hints
Fill the Hint field to display a clickable blue box on the front side

On the back side, the hint reveals automatically when the card flips

Leave blank to omit the hint box entirely

### Tags
Your tags should be structured as follows: `content::C1::C2::C3 src::S1::S2::S3`

The `Cn` and `Sn` stand for hierarchically-labelled content and source tags respectively. You don't have to fill in all the numbers (e.g. the example image below used `content::Deep_Learning::Neural_Nets::GANs src::fast.ai`

Your tags will be displayed on the card in alphabetical order

### URL
If you fill in the `URL` field, then the first `src` tag will be replaced with a hyperlink to that url

**Key point** - make sure to copy the URL as raw text (by doing `Ctrl+Shift+v`). If you don't, then it will show up as blue in the Anki editor, and it won't work. One way to check this is to press `Ctrl+Shift+x` to open the HTML editor, and check that the URL only appears as raw text there

If you don't fill in this field, then there will be no hyperlink, but the tags will still work fine


# Development
## Generating JavaScript
To generate the required JavaScript functions that are embedded in front_template.html and back_template.html, run the following command at the root of this repo:
`npx tsc -p tsconfig.json`

This will output the generated javascript file under `dist/` which you can then use to copy into the front and back templates.

## Running tests
Unit tests can be run using `npm test` (will first be required to run `npm install` to install dev dependencies from package.json)
