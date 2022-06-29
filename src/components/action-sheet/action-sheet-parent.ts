import { ViewChild } from '@angular/core';
import { ActionSheetComponent } from './action-sheet';

export type dismissFunction = (data?: any) => void;
export class ActionSheetParent {
  public params: any;
  public componentRef: any;
  public sheetType: string;
  public dismissFunction: dismissFunction;

  @ViewChild(ActionSheetComponent)
  actionSheet: ActionSheetComponent;

  public async present(): Promise<void> {
    return this.actionSheet.present(this.componentRef);
  }

  public async dismiss(data?: any): Promise<void> {
    await this.actionSheet.dismiss(data);
  }

  public onDidDismiss(func: dismissFunction) {
    this.dismissFunction = func;
    this.actionSheet.dismissFunction = func;
  }
}
