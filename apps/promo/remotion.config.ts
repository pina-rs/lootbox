/**
 * Studio and CLI settings. Renders go through `scripts/render.ts`, which
 * applies the same webpack override and picks the browser.
 */
import { Config } from "@remotion/cli/config";

import { automaticJsx } from "./webpack-override.ts";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setConcurrency(4);
Config.overrideWebpackConfig(automaticJsx);
