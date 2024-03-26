import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ReshortPage } from './reshort.page';

const routes: Routes = [
  {
    path: '',
    component: ReshortPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReshortPageRoutingModule {}
