---
title: Custom renderer in Angular
metaTitle: Custom cell renderer - Angular Data Grid | Handsontable
description: Create a custom cell renderer, and use it in your Angular data grid by declaring it as a function.
permalink: /angular-custom-renderer-example
canonicalUrl: /angular-custom-renderer-example
searchCategory: Guides
---

# Custom renderer in Angular

Create a custom cell renderer, and use it in your Angular data grid by declaring it as a function.

[[toc]]

## Example

The following example is an implementation of `@handsontable/angular` with a custom renderer added. It takes an image URL as the input and renders the image in the edited cell.

::: example :angular --html 1 --js 2
```html
<app-root></app-root>
```

```js
// app.component.ts
import { Component } from '@angular/core';
import Handsontable from 'handsontable/base';
import { textRenderer } from 'handsontable/renderers/textRenderer';

@Component({
  selector: 'app-root',
  template: `
  <div>
    <hot-table [settings]="hotSettings"></hot-table>
  </div>
  `,
})
class AppComponent {
  hotSettings: Handsontable.GridSettings = {
    data:
      [
        ['A1', '{{$basePath}}/img/examples/professional-javascript-developers-nicholas-zakas.jpg'],
        ['A2', '{{$basePath}}/img/examples/javascript-the-good-parts.jpg']
      ],
    columns: [
      {},
      {
        renderer(instance, td, row, col, prop, value, cellProperties) {
          const img = document.createElement('img');

          img.src = value;

          img.addEventListener('mousedown', event => {
            event.preventDefault();
          });

          td.innerText = '';
          td.appendChild(img);

          return td;
        }
      }
    ],
    colHeaders: true,
    rowHeights: 55,
    height: 'auto',
    licenseKey: 'non-commercial-and-evaluation'
  };
}

// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HotTableModule } from '@handsontable/angular';
import { registerAllModules } from 'handsontable/registry';

// register Handsontable's modules
registerAllModules();

@NgModule({
  imports:      [ BrowserModule, HotTableModule ],
  declarations: [ AppComponent ],
  bootstrap:    [ AppComponent ]
})
class AppModule { }

// bootstrap
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

platformBrowserDynamic().bootstrapModule(AppModule).catch(err => { console.error(err) });
```
:::

## Related articles

### Related guides

- [Cell renderer](@/guides/cell-functions/cell-renderer.md)

### Related API reference

- APIs:
  - [`BasePlugin`](@/api/basePlugin.md)
- Configuration options:
  - [`renderer`](@/api/options.md#renderer)
- Core methods:
  - [`getCellMeta()`](@/api/core.md#getcellmeta)
  - [`getCellMetaAtRow()`](@/api/core.md#getcellmetaatrow)
  - [`getCellsMeta()`](@/api/core.md#getcellsmeta)
  - [`getCellRenderer()`](@/api/core.md#getcellrenderer)
  - [`setCellMeta()`](@/api/core.md#setcellmeta)
  - [`setCellMetaObject()`](@/api/core.md#setcellmetaobject)
  - [`removeCellMeta()`](@/api/core.md#removecellmeta)
- Hooks:
  - [`afterGetCellMeta`](@/api/hooks.md#aftergetcellmeta)
  - [`afterGetColumnHeaderRenderers`](@/api/hooks.md#aftergetcolumnheaderrenderers)
  - [`afterGetRowHeaderRenderers`](@/api/hooks.md#aftergetrowheaderrenderers)
  - [`afterRenderer`](@/api/hooks.md#afterrenderer)
  - [`beforeGetCellMeta`](@/api/hooks.md#beforegetcellmeta)
  - [`beforeRenderer`](@/api/hooks.md#beforerenderer)
