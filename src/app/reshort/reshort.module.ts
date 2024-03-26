import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ReshortPageRoutingModule } from './reshort-routing.module';

import { ReshortPage } from './reshort.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReshortPageRoutingModule
  ],
  declarations: [ReshortPage]
})
export class ReshortPageModule {}
