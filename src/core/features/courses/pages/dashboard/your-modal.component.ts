// // your-modal.component.ts

// import { Component, Input } from '@angular/core';
// import { ModalController } from '@ionic/angular';

// @Component({
//   selector: 'app-your-modal',
//   template: `
//     <ion-header>
//       <ion-toolbar>
//         <ion-title>{{ title }}</ion-title>
//         <ion-buttons slot="end">
//           <ion-button (click)="dismiss()">Close</ion-button>
//         </ion-buttons>
//       </ion-toolbar>
//     </ion-header>
//     <ion-content>
//       <div>
//         <!-- Your static content goes here -->
//         <p>This is a sample modal content.</p>
//       </div>
//     </ion-content>
//   `,
// })
// export class YourModalComponent {
//   @Input() title: string;

//   constructor(private modalController: ModalController) {}

//   dismiss() {
//     this.modalController.dismiss();
//   }
// }
