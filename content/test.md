aJPEG uses a lot of clever tricks that take advantage of the human visual system to pack as much information that is important to human visual reconstruction of the image into as little raw digital information as possible.

## It’s compression!

Compression techniques look for repeated patterns in the data and then replace those patterns with shorter ones.
The problem with images and sound is that this data is usually too noisy to find good abbreviations.
It’s lossy!
Lossy compression is often used for photos, audio, and video in situations in which absolute accuracy isn’t essential. Most of the time, we don’t notice if a picture, song, or movie isn’t perfectly reproduced. The loss in fidelity becomes more perceptible only as files are squeezed very tightly. In those cases, we notice what are known as compression artifacts: the fuzziness of the smallest jpeg and mpeg images, or the tinny sound of low-bit-rate MP3s.
JPEG gets around it by only choosing ‘visually important’ information to keep and either keeping around lower quality version of it or dropping it altogether
Two main principles:
Changes in brightness are more important than changes in colour: the human retina contains about 120 million brightness-sensitive rod cells, but only about 6 million colour-sensitive cone cells.
Low-frequency changes are more important than high-frequency changes: we notice the boundaries of objects much more easily than the fine detail and patterning on it.
Encoding
Colour Transformation
(yes with a u)

Normally, image information in computers are stored as pixels ([W, H, 3])
3 Channel — R, G, B
However, the image’s brightness information is spread evenly through the R, G, and B channels.
Each channel value is from 0 to 255 for brightness of that colour.
One optimization we can do is decreasing the bandwidth or resolution allocated to “color” compared to “black and white”, since humans are more sensitive to the black-and-white information. This is called chroma subsampling.
Old televisions used to do this because RGB was way too redundant so they wanted something that compressed better.
Originally for standard-definition television use in the ITU-R BT.601 standard for use with digital component video
JPEG converts from RGB colour space to YCbCr
Y is the luma (brightness) component and Cb and Cr are the blue-difference and red-difference chroma (colour) components
Y normally has a range of 0 to 1
Cb and Cr normally have a range of -0.5 (negative amount of the colour) to 0.5 (positive amount of the colour

For this example, after keeping only a quarter of the colour information, we already reach a 2x compression ratio. Notice that we started with 3 full channels and now we have 1 full channel and 2 × ¼ channels!

## Spatial to Frequency Domain

Finally, a tangible use-case for a Fourier transform! Specifically, the Discrete Fourier Transform.

Go from a signal to its component parts
